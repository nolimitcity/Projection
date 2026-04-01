export class AppError extends Error {
  public readonly status: number;
  public readonly title: string;
  public readonly detail: string;
  public readonly code: string;
  public readonly extras?: Record<string, unknown>;

  constructor(args: {
    status: number;
    title: string;
    detail: string;
    code: string;
    extras?: Record<string, unknown>;
  }) {
    super(args.detail);
    this.status = args.status;
    this.title = args.title;
    this.detail = args.detail;
    this.code = args.code;
    this.extras = args.extras;
  }
}

export const forbidden = (detail: string) =>
  new AppError({
    status: 403,
    title: "Forbidden",
    detail,
    code: "AUTH_FORBIDDEN"
  });

export const unauthorized = (detail: string) =>
  new AppError({
    status: 401,
    title: "Unauthorized",
    detail,
    code: "AUTH_UNAUTHORIZED"
  });

export const notFound = (detail: string, extras?: Record<string, unknown>) =>
  new AppError({
    status: 404,
    title: "Not Found",
    detail,
    code: "RESOURCE_NOT_FOUND",
    extras
  });

export const conflict = (detail: string, extras?: Record<string, unknown>) =>
  new AppError({
    status: 409,
    title: "Conflict",
    detail,
    code: "NAME_CONFLICT",
    extras
  });

export const badRequest = (detail: string, extras?: Record<string, unknown>) =>
  new AppError({
    status: 400,
    title: "Bad Request",
    detail,
    code: "VALIDATION_ERROR",
    extras
  });
