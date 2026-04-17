import Joi from "joi";

const LoginSchema = Joi.object({
  username: Joi.string().trim().min(3).messages({
    "string.min": "Username must be at least 3 characters long.",
  }),

  mobileNumber: Joi.string().trim()
    .pattern(/^09\d{9}$/)
    .messages({
      "string.pattern.base": "Invalid PH mobile number.",
    }),

  password: Joi.string().min(8).required().messages({
    "string.min": "Password must be at least 8 characters long.",
    "any.required": "Password is required.",
  }),
})
  .or("username", "mobileNumber")
  .messages({
    "object.missing": "Either username or mobileNumber must be present.",
  });

export default LoginSchema;
