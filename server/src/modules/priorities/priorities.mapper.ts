export interface PriorityEntity {
  id: string;
  key: string;
  name: string;
  color: string;
  position: number;
}

export const toPriorityEntity = (p: { _id: unknown; key: string; name: string; color: string; position: number }): PriorityEntity => ({
  id: String(p._id),
  key: p.key,
  name: p.name,
  color: p.color,
  position: p.position,
});

/** What the API returns: the position is an internal detail. */
export const toPriorityDTO = ({ id, key, name, color }: PriorityEntity) => ({ id, key, name, color });
