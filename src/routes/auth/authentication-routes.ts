import { Server, Request, ResponseToolkit } from "@hapi/hapi";
import { RegistrationController, LoginController, } from "../../controller/auth/index.ts";
import { LoginSchema, RegistrationSchema } from "../../schema/index.ts";

const AuthenticationPlugin = {
  name: "app-auth-routes",
  register: async (server: Server) => {
    server.route([
      {
        method: "POST",
        path: "/registration",
        options: {
          validate: {
            payload: RegistrationSchema,
            failAction: (request, h, err) => {
              throw err;
            },
          },
        },
        handler: RegistrationController.registerUser,
      },
      {
        method: "POST",
        path: "/login",
        options: {
          validate: {
            payload: LoginSchema,
            failAction: (request, h, err) => {
              throw err;
            },
          },
        },
        handler: LoginController.login,
      },
      {
        method: "*",
        path: "/{any*}",
        handler: (request: Request, h: ResponseToolkit) => {
          return h.response("<h1>404</h1>").code(404);
        },
      },
    ]);
  },
};

export default AuthenticationPlugin;