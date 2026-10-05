import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  let service: PrismaService;

  beforeEach(() => {
    // Constructing the client does not open a connection.
    service = new PrismaService();
  });

  it('exposes the models used by the application', () => {
    expect(service.user).toBeDefined();
    expect(service.category).toBeDefined();
    expect(service.task).toBeDefined();
    expect(service.taskCompletion).toBeDefined();
  });

  it('connects when the module starts', async () => {
    const connect = jest.spyOn(service, '$connect').mockResolvedValue();

    await service.onModuleInit();

    expect(connect).toHaveBeenCalledTimes(1);
  });

  it('disconnects when the module is destroyed', async () => {
    const disconnect = jest.spyOn(service, '$disconnect').mockResolvedValue();

    await service.onModuleDestroy();

    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
