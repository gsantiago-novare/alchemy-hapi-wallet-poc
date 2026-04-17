import Joi from "joi";

const RegistrationSchema = Joi.object({
  username: Joi.string().min(3).max(50).required().messages({
    "string.min": "Username must be at least 3 characters long.",
    "string.max": "Username cannot exceed 50 characters.",
    "any.required": "Username is a required field.",
  }),

  password: Joi.string().min(8).required().messages({
    "string.min": "Password must be at least 8 characters long.",
    "any.required": "Password is required.",
  }),

  mobileNumber: Joi.string()
    .pattern(/^09\d{9}$/)
    .required()
    .messages({
      "string.pattern.base": "Invalid PH mobile number.",
      "any.required": "Mobile number is required.",
    }),
});

export default RegistrationSchema;
