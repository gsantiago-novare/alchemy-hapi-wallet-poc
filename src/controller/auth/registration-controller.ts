import { Request, ResponseToolkit } from "@hapi/hapi";
import { UserService } from "../../service/auth/index";
import Boom from "@hapi/boom";
import AppError from "../../errors/AppError";

const RegistrationController = {
  registerUser: async (request: Request, h: ResponseToolkit) => {
    const { username, password, mobileNumber } = request.payload as any;

    try {
      await UserService.registerUser({
        username,
        password,
        mobileNumber,
      });

      return h.response({ message: "User registered successfully" }).code(201);
    } catch (error: any) {
      console.error("Error during registration:", error);
      if (error instanceof AppError) {
        throw Boom.boomify(error, { statusCode: error.statusCode});
      }
      throw Boom.internal();
    }
  },
};

export default RegistrationController;
