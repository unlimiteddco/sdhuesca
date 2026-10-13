// Enlace con la tienda oficial (Shopify). Comprobado el 12 oct 2026: el formulario de la tienda
// guarda la personalización en la propiedad "Serigrafia" con el formato "<dorsal> | <nombre>",
// sobre la variante "Personalizar" de cada talla. Si la tienda cambia producto o variantes,
// hay que actualizar estos identificadores.
export const STORE = {
  product: 'https://tienda.sdhuesca.es/products/camiseta-primera-equipacion-2026-2027',
  cart: 'https://tienda.sdhuesca.es/cart/add',
  property: 'Serigrafia',
  /** Variante "Personalizar" de cada talla */
  sizes: [
    { label: 'S', variant: '57191686701436' },
    { label: 'M', variant: '57191686799740' },
    { label: 'L', variant: '57191686898044' },
    { label: 'XL', variant: '57191686996348' },
    { label: '2XL', variant: '57191687094652' },
  ],
  /** Límites del formulario de la tienda */
  maxName: 10,
  maxNumber: 2,
};

/** Añade a la cesta oficial la camiseta con esa serigrafía y deja al comprador en su cesta */
export const cartUrl = (variant: string, name: string, number: string) =>
  `${STORE.cart}?id=${variant}&quantity=1&properties%5B${STORE.property}%5D=${encodeURIComponent(`${number} | ${name}`)}`;
