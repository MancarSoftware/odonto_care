import { Controller, Get } from "@nestjs/common";

@Controller("health")
export class HealthController {
  @Get()
  check() {
    return {
      name: "OdontoCare API",
      status: "ok",
      timestamp: new Date().toISOString(),
    };
  }
}
