export interface ColumnEntity {
  id: string;
  key: string;
  name: string;
  isDone: boolean;
  color: string | null;
  position: number;
}

export const toColumnEntity = (c: { _id: unknown; key: string; name: string; isDone: boolean; color?: string | null; position: number }): ColumnEntity => ({
  id: String(c._id),
  key: c.key,
  name: c.name,
  isDone: c.isDone,
  color: c.color ?? null,
  position: c.position,
});

/** What the API returns: the position is an internal detail. */
export const toColumnDTO = ({ id, key, name, isDone, color }: ColumnEntity) => ({ id, key, name, isDone, color });
