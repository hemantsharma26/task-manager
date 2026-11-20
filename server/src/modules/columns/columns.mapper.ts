export interface ColumnEntity {
  id: string;
  key: string;
  name: string;
  isDone: boolean;
  position: number;
}

export const toColumnEntity = (c: { _id: unknown; key: string; name: string; isDone: boolean; position: number }): ColumnEntity => ({
  id: String(c._id),
  key: c.key,
  name: c.name,
  isDone: c.isDone,
  position: c.position,
});

/** What the API returns: the position is an internal detail. */
export const toColumnDTO = ({ id, key, name, isDone }: ColumnEntity) => ({ id, key, name, isDone });
