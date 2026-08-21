import { Inject } from '@nestjs/common';

export const ENV = Symbol('ENV');

export const InjectEnv = (): ParameterDecorator => Inject(ENV);
