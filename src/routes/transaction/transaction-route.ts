import { Server, Request, ResponseToolkit } from "@hapi/hapi";
import { TransactionController } from "../../controller/transaction/index";
import { TransferSchema } from "../../schema/index.ts";

const TransactionRouter = {
  name: "transaction-routes",
  version: "1.0.0",
  register: async (server: Server) => {
    server.route([
      {
        method: "POST",
        path: "/transfer",
        options: {
          validate: {
            payload: TransferSchema,
            failAction: (request, h, err) => {
              throw err;
            },
          },
        },
        handler: TransactionController.transferMoney,
      },
      {
        method: "*",
        path: "/{any*}",
        handler: (request: Request, h: ResponseToolkit) => {
          console.log("404 not found", request.url.pathname);
          return h.response("<h1>404</h1>").code(404);
        },
      },
    ]);
  },
};

export default TransactionRouter;