import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  // Almost every endpoint needs the database, so "healthy" includes it: a
  // server that runs without one still cannot serve anything useful.
  @Get('health')
  async getHealth(): Promise<{ status: string }> {
    if (!(await this.appService.isDatabaseUp())) {
      throw new ServiceUnavailableException('Database unavailable');
    }
    return { status: 'ok' };
  }
}
