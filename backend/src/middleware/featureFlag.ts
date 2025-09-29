import type { Request, Response, NextFunction } from 'express';
import { assertFeatureEnabled, FeatureDisabledError } from '../lib/featureFlags';

export const requireFeature = (flag: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      assertFeatureEnabled(flag);
      next();
    } catch (error) {
      if (error instanceof FeatureDisabledError) {
        return res.status(403).json({
          error: {
            message: error.message,
            flag,
          },
        });
      }

      next(error);
    }
  };
};
