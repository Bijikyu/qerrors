// Placeholder for entity guards
export const throwIfNotFound = <T>(entity: T | null | undefined, entityName: string): T => {
  if (!entity) throw new Error(`${entityName} not found`);
  return entity;
};
export const throwIfNotFoundObj = <T>(input: { entity: T | null | undefined; entityName: string }) => ({ entity: input.entity, found: !!input.entity });
export const throwIfNotFoundMany = (entities: Array<{ entity: any; entityName: string }>) => entities;
export const throwIfNotFoundWithMessage = <T>(entity: T | null | undefined, errorMessage: string): T => {
  if (!entity) throw new Error(errorMessage);
  return entity;
};
export const entityExists = <T>(entity: T | null | undefined): boolean => !!entity;
export const assertEntityExists = <T>(entity: T | null | undefined, entityName: string): T => {
  if (!entity) throw new Error(`${entityName} does not exist`);
  return entity;
};