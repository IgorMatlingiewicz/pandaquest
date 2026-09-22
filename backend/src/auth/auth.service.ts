import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Prisma, TaskType, CompletionMode } from '../generated/prisma/client';

type DefaultTaskSeed = {
  title: string;
  completionMode: CompletionMode;
  progressTarget?: number;
  progressCurrent?: number;
};

type DefaultCategorySeed = {
  name: string;
  icon: string;
  cycleType: TaskType;
  tasks: DefaultTaskSeed[];
};

const DEFAULT_CATEGORIES: DefaultCategorySeed[] = [
  {
    name: 'Dzienne',
    icon: '☀️',
    cycleType: TaskType.DAILY,
    tasks: [
      {
        title: 'Wyprowadź psa',
        completionMode: CompletionMode.PROGRESS,
        progressTarget: 3,
        progressCurrent: 1,
      },
      { title: 'Weź tabletki', completionMode: CompletionMode.BOOLEAN },
    ],
  },
  {
    name: 'Tygodniowe',
    icon: '📅',
    cycleType: TaskType.WEEKLY,
    tasks: [
      { title: 'Zrób pranie', completionMode: CompletionMode.BOOLEAN },
      { title: 'Zrób zakupy', completionMode: CompletionMode.BOOLEAN },
      {
        title: 'Idź na siłownię',
        completionMode: CompletionMode.PROGRESS,
        progressTarget: 3,
        progressCurrent: 2,
      },
    ],
  },
  {
    name: 'Życiowe',
    icon: '🎯',
    cycleType: TaskType.LIFE,
    tasks: [
      { title: 'Kup dom', completionMode: CompletionMode.BOOLEAN },
      {
        title: 'Oszczędź 100 000 PLN',
        completionMode: CompletionMode.PROGRESS,
        progressTarget: 100000,
        progressCurrent: 27000,
      },
      {
        title: 'Naucz się grać na skrzypcach',
        completionMode: CompletionMode.BOOLEAN,
      },
    ],
  },
];

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email już zajęty');
    }

    const passwordHash = await argon2.hash(dto.password);

    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: dto.email,
          username: dto.username,
          passwordHash,
        },
      });

      await this.seedDefaultCategories(tx, createdUser.id);

      return createdUser;
    });

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      xpTotal: user.xpTotal,
      level: user.level,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private async seedDefaultCategories(
    tx: Prisma.TransactionClient,
    userId: string,
  ) {
    for (const [categoryIndex, category] of DEFAULT_CATEGORIES.entries()) {
      const createdCategory = await tx.category.create({
        data: {
          userId,
          name: category.name,
          icon: category.icon,
          cycleType: category.cycleType,
          isDeletable: false,
          order: categoryIndex,
        },
      });

      for (const [taskIndex, task] of category.tasks.entries()) {
        await tx.task.create({
          data: {
            userId,
            categoryId: createdCategory.id,
            title: task.title,
            type: category.cycleType,
            completionMode: task.completionMode,
            progressTarget: task.progressTarget,
            progressCurrent: task.progressCurrent,
            order: taskIndex,
          },
        });
      }
    }
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Nieprawidłowy email lub hasło');
    }

    const passwordValid = await argon2.verify(user.passwordHash, dto.password);

    if (!passwordValid) {
      throw new UnauthorizedException('Nieprawidłowy email lub hasło');
    }

    const token = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
    });

    return { accessToken: token };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new UnauthorizedException();
    }

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      xpTotal: user.xpTotal,
      level: user.level,
    };
  }
}
