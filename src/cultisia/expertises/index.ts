import { agroeconomiste } from "./agroeconomiste";
import { agronome } from "./agronome";
import { marche } from "./marche";
import { pilotage } from "./pilotage";
import { transformation } from "./transformation";
import type { Expertise, IdExpertise } from "./type";
import { zootechnicien } from "./zootechnicien";

export type { Expertise, IdExpertise } from "./type";

export const EXPERTISES: Record<IdExpertise, Expertise> = {
  agronome,
  zootechnicien,
  transformation,
  agroeconomiste,
  marche,
  pilotage,
};
