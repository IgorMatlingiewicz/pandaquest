import { Test, TestingModule } from '@nestjs/testing';
import { CategoryController } from './category.controller';
import { CategoryService } from './category.service';

// @nestjs/passport and @nestjs/mapped-types ship ESM only, which Jest cannot
// load here. The guard is replaced, and PartialType (used by the update DTO)
// gets a stand-in; DTO validation is not what these tests cover.
jest.mock('@nestjs/mapped-types', () => ({
  PartialType: <T extends new () => object>(base: T) => base,
}));
jest.mock('../auth/jwt-auth.guard', () => ({
  JwtAuthGuard: class JwtAuthGuard {
    canActivate() {
      return true;
    }
  },
}));
jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

type AuthedRequest = Parameters<CategoryController['findAll']>[0];

describe('CategoryController', () => {
  const USER_ID = 'user-1';
  const req = {
    user: { userId: USER_ID, email: 'user@example.com' },
  } as AuthedRequest;

  const categoryService = {
    create: jest.fn(),
    findAll: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    reorder: jest.fn(),
  };
  let controller: CategoryController;

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoryController],
      providers: [{ provide: CategoryService, useValue: categoryService }],
    }).compile();

    controller = module.get<CategoryController>(CategoryController);
  });

  it('create uses the user id from the token', async () => {
    const dto = { name: 'Treningi' };

    await controller.create(req, dto);

    expect(categoryService.create).toHaveBeenCalledWith(USER_ID, dto);
  });

  it('findAll returns the categories of the authenticated user', async () => {
    categoryService.findAll.mockResolvedValue([{ id: 'category-1' }]);

    await expect(controller.findAll(req)).resolves.toEqual([
      { id: 'category-1' },
    ]);
    expect(categoryService.findAll).toHaveBeenCalledWith(USER_ID);
  });

  it('update scopes the change to the authenticated user', async () => {
    const dto = { name: 'Sport' };

    await controller.update(req, 'category-1', dto);

    expect(categoryService.update).toHaveBeenCalledWith(
      USER_ID,
      'category-1',
      dto,
    );
  });

  it('remove scopes the delete to the authenticated user', async () => {
    await controller.remove(req, 'category-1');

    expect(categoryService.remove).toHaveBeenCalledWith(USER_ID, 'category-1');
  });

  it('reorder passes only the items to the service', async () => {
    const items = [
      { id: 'category-1', order: 1 },
      { id: 'category-2', order: 0 },
    ];

    await controller.reorder(req, { items });

    expect(categoryService.reorder).toHaveBeenCalledWith(USER_ID, items);
  });
});
