/**
 * Ajuste de tipos para Express: params como string en rutas normales (:id).
 * ParamsFlatDictionary asegura params.xxx sea string (no string[]).
 */
import type { ParamsFlatDictionary } from 'express-serve-static-core';

declare global {
  namespace Express {
    interface Request {
      params: ParamsFlatDictionary;
    }
  }
}

export {};
