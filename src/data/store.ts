// Enlace con la tienda oficial del club (Shopify): añade a su cesta la camiseta con la serigrafía
// del personalizador. Producto, variantes y propiedades están en clubs/<club>/club.json; si la
// tienda cambia el producto, hay que actualizarlos allí.
import { CLUB } from '../club';

export const STORE = CLUB.store;

/** Añade a la cesta oficial la camiseta con esa serigrafía y deja al comprador en su cesta */
export function cartUrl(variant: string, name: string, number: string) {
  const props = Object.entries(STORE.properties as Record<string, string>)
    .map(([key, value]) => `&properties%5B${encodeURIComponent(key)}%5D=${encodeURIComponent(value.replace('{name}', name).replace('{number}', number))}`)
    .join('');
  return `${STORE.cart}?id=${variant}&quantity=1${props}`;
}
