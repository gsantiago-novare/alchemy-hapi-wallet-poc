import { Request, ResponseToolkit } from "@hapi/hapi";
import { UserService } from "../../service/auth/index";
import Boom from "@hapi/boom";
import AppError from "../../errors/AppError";

const LoginController = {
  login: async (request: Request, h: ResponseToolkit) => {
    const { username, password, mobileNumber } = request.payload as any;

    try {
      const loginDetails = await UserService.login({
        username,
        password,
        mobileNumber,
      });

      return h
        .response({
          message: "User logged in successfully",
          data: loginDetails,
        })
        .code(200);
    } catch (error: any) {
      console.error("Error during login:", error);
      if (error instanceof AppError) {
        throw Boom.boomify(error, { statusCode: error.statusCode });
      }
      throw Boom.internal();
    }
  },
};

export default LoginController;
