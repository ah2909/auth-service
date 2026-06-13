import { validationResult } from "express-validator";

// Terminates the request with 422 if any preceding express-validator
// checks failed; otherwise hands off to the route handler.
export const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
    }
    next();
};
