import { z } from "zod";

export const clientSchema = z.object({
  name: z.string().trim().min(1, "Client name is required").max(100, "Name must be less than 100 characters"),
  currency: z.string().min(1, "Currency is required"),
  client_type: z.enum(["Individual", "Company", "NGO", "Government"]),
  contact_email: z.string().email("Invalid email address").or(z.literal("")).optional(),
  contact_phone: z.string().max(20, "Phone must be less than 20 characters").optional(),
});

export type ClientFormData = z.infer<typeof clientSchema>;

export const transactionSchema = z.object({
  date: z.date({ required_error: "Date is required" }),
  description: z.string().trim().min(1, "Description is required").max(255, "Description must be less than 255 characters"),
  amount: z.string().refine(val => {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0;
  }, "Amount must be a positive number"),
  type: z.enum(["income", "expense"], {
    required_error: "Type is required",
  }),
  category_id: z.string().optional(),
  account_id: z.string().optional(),
  notes: z.string().max(500, "Notes must be less than 500 characters").optional(),
});

export type TransactionFormData = z.infer<typeof transactionSchema>;

export const accountSchema = z.object({
  code: z.string().trim().min(1, "Account code is required").max(20, "Code must be less than 20 characters"),
  name: z.string().trim().min(1, "Account name is required").max(100, "Name must be less than 100 characters"),
  type: z.enum(["asset", "liability", "equity", "income", "expense"], {
    required_error: "Account type is required",
  }),
  description: z.string().max(255, "Description must be less than 255 characters").optional(),
});

export type AccountFormData = z.infer<typeof accountSchema>;

export const categorySchema = z.object({
  name: z.string().trim().min(1, "Category name is required").max(50, "Name must be less than 50 characters"),
  type: z.enum(["income", "expense"], {
    required_error: "Category type is required",
  }),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format").optional(),
  account_id: z.string().optional(),
});

export type CategoryFormData = z.infer<typeof categorySchema>;
