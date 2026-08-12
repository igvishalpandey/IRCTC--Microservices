import type { Response } from "express";

class ApiResponse<T> {
  readonly statusCode: number;
  readonly data: T;
  readonly message: string;

  constructor(statusCode: number, data: T, message = "Success") {
    this.statusCode = statusCode;
    this.data = data;
    this.message = message;
  }

  send(res: Response): Response {
    return res.status(this.statusCode).json({
      success: true,
      message: this.message,
      data: this.data,
    });
  }
}

export default ApiResponse;
