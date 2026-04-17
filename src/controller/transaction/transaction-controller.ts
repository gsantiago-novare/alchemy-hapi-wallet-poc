import { Request, ResponseToolkit } from "@hapi/hapi";
import { WalletService } from "../../service/wallet/index";
import Boom from "@hapi/boom";
import AppError from "../../errors/AppError";

const TransactionController = {
  transferMoney: async (request: Request, h: ResponseToolkit) => {
    const { senderWalletId, receiverWalletId, amount } = request.payload as any;

    try {
      const result = await WalletService.transferMoney({
        senderWalletId,
        receiverWalletId,
        amount,
      });

      return h
        .response({
          message: "Transfer completed successfully",
          data: result,
        })
        .code(201);
    } catch (error: any) {
      console.error("Error during money transfer:", error);
      if (error instanceof AppError) {
        throw Boom.boomify(error, { statusCode: error.statusCode });
      }
      throw Boom.internal();
    }
  },
};

export default TransactionController;
