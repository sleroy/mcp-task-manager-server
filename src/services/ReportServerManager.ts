import http from "node:http";
import { AddressInfo } from "node:net";
import { ReportService } from "./ReportService.js";
import { NotFoundError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { REPORT_HTML } from "./reportServerHtml.js";

export interface ReportServerInfo {
  url: string;
  host: string;
  port: number;
  already_running: boolean;
}

/**
 * Manages a local, read-only HTTP server that serves a navigable web report
 * (projects, progress, epics/stories/tasks, sprints, milestones) backed by
 * ReportService. Binds to loopback by default. Singleton per process: calling
 * start() again returns the currently running instance.
 */
export class ReportServerManager {
  private server: http.Server | null = null;
  private host = "127.0.0.1";
  private port = 0;

  constructor(private reportService: ReportService) {}

  public isRunning(): boolean {
    return this.server !== null && this.server.listening;
  }

  public getInfo(): ReportServerInfo | null {
    if (!this.isRunning()) {
      return null;
    }
    return {
      url: `http://${this.host}:${this.port}/`,
      host: this.host,
      port: this.port,
      already_running: true,
    };
  }

  /**
   * Starts the HTTP server. Idempotent: if already running, resolves with the
   * existing server info and already_running=true.
   * @param requestedPort Port to bind to; 0 selects a random free port.
   * @param host Host/interface to bind to. Defaults to loopback.
   */
  public async start(
    requestedPort = 0,
    host = "127.0.0.1"
  ): Promise<ReportServerInfo> {
    if (this.isRunning()) {
      const info = this.getInfo();
      if (info) {
        logger.info(`[ReportServer] Already running at ${info.url}; reusing.`);
        return info;
      }
    }

    this.host = host;
    const server = http.createServer((req, res) => {
      this.handleRequest(req, res).catch((error) => {
        logger.error("[ReportServer] Unhandled request error:", error);
        this.sendJson(res, 500, {
          error: "Internal Server Error",
        });
      });
    });

    return new Promise<ReportServerInfo>((resolve, reject) => {
      const onError = (error: NodeJS.ErrnoException) => {
        logger.error("[ReportServer] Failed to start:", error);
        reject(error);
      };
      server.once("error", onError);
      server.listen(requestedPort, host, () => {
        server.removeListener("error", onError);
        this.server = server;
        const address = server.address() as AddressInfo;
        this.port = address.port;
        const info: ReportServerInfo = {
          url: `http://${this.host}:${this.port}/`,
          host: this.host,
          port: this.port,
          already_running: false,
        };
        logger.info(`[ReportServer] Listening at ${info.url}`);
        resolve(info);
      });
    });
  }

  public async stop(): Promise<void> {
    if (!this.server) {
      return;
    }
    const server = this.server;
    this.server = null;
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    logger.info("[ReportServer] Stopped.");
  }

  private async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    const method = (req.method || "GET").toUpperCase();
    if (method !== "GET" && method !== "HEAD") {
      this.sendJson(res, 405, { error: "Method Not Allowed" });
      return;
    }

    const url = new URL(req.url || "/", `http://${this.host}:${this.port}`);
    const pathname = decodeURIComponent(url.pathname);

    // API routes
    if (pathname === "/api/projects") {
      const overviews = await this.reportService.listProjectOverviews();
      this.sendJson(res, 200, overviews);
      return;
    }

    const projectMatch = pathname.match(/^\/api\/projects\/([^/]+)$/);
    if (projectMatch) {
      const projectId = projectMatch[1];
      try {
        const detail = await this.reportService.getProjectDetail(projectId);
        this.sendJson(res, 200, detail);
      } catch (error) {
        if (error instanceof NotFoundError) {
          this.sendJson(res, 404, { error: error.message });
        } else {
          throw error;
        }
      }
      return;
    }

    if (pathname === "/api/statuses") {
      this.sendJson(res, 200, this.reportService.getStatuses());
      return;
    }

    // HTML app (index and any non-API path so client-side routing works)
    if (pathname === "/" || !pathname.startsWith("/api/")) {
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      });
      res.end(method === "HEAD" ? undefined : REPORT_HTML);
      return;
    }

    this.sendJson(res, 404, { error: "Not Found" });
  }

  private sendJson(
    res: http.ServerResponse,
    statusCode: number,
    payload: unknown
  ): void {
    const body = JSON.stringify(payload);
    res.writeHead(statusCode, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(body);
  }
}
