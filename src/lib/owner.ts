/**
 * Conta do criador do sistema (Rubatinno). Nenhum admin consegue tirar o
 * cargo de admin dela, reprová-la ou removê-la — por nenhuma tela.
 */
export const OWNER_USER_ID = "b7ed805b-ebfc-40d3-aef4-8db8eac475ad";
export const OWNER_EMAIL = "luizflaviorubatino10@gmail.com";

export const OWNER_PROTECTED_MESSAGE = "Essa é a conta do criador do sistema — ela é sempre admin e não pode ser removida.";

export function isOwner(person: { user_id?: string | null; id?: string | null; email?: string | null }) {
  return (
    person.user_id === OWNER_USER_ID ||
    person.id === OWNER_USER_ID ||
    person.email?.trim().toLowerCase() === OWNER_EMAIL
  );
}
