import Joi from "joi";

const TransferSchema = Joi.object({
  senderWalletId: Joi.number().integer().positive().required().messages({
    "number.base": "Sender ID must be a number",
    "number.positive": "Sender ID must be a positive integer",
  }),

  receiverWalletId: Joi.number()
    .integer()
    .positive()
    .not(Joi.ref("senderWalletId"))
    .required()
    .messages({
      "any.invalid": "Sender and receiver cannot be the same wallet.",
      "number.positive": "Receiver ID must be a positive integer",
    }),

  amount: Joi.number().positive().required().messages({
    "number.positive": "Amount must be greater than 0",
  }),
});

export default TransferSchema;
