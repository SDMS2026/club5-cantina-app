export interface EmojiItem {
  emoji: string;
  nombre: string;
  categoria: 'bebidas' | 'comidas' | 'snacks' | 'frutas' | 'varios';
  tags: string[];
}

export interface CategoriaEmoji {
  id: 'bebidas' | 'comidas' | 'snacks' | 'frutas' | 'varios';
  nombre: string;
  icono: string;
}

export const CATEGORIAS_EMOJIS: CategoriaEmoji[] = [
  { id: 'comidas', nombre: 'Comidas / Salados', icono: '🥟' },
  { id: 'bebidas', nombre: 'Bebidas', icono: '🥤' },
  { id: 'snacks', nombre: 'Snacks y Dulces', icono: '🍪' },
  { id: 'frutas', nombre: 'Frutas', icono: '🍎' },
  { id: 'varios', nombre: 'Útiles / Varios', icono: '📦' },
];

export const CATEGORIAS_PRODUCTOS_SISTEMA = [
  'Desayunos y Salados',
  'Bebidas y Jugos',
  'Snacks y Dulces',
  'Frutas y Saludables',
  'Útiles y Varios',
] as const;

export type CategoriaProducto = (typeof CATEGORIAS_PRODUCTOS_SISTEMA)[number];

export const CATALOGO_EMOJIS: EmojiItem[] = [
  // 🥤 BEBIDAS
  { emoji: '💧', nombre: 'Agua Mineral', categoria: 'bebidas', tags: ['agua', 'mineral', 'botella', 'h2o', 'gota'] },
  { emoji: '🧊', nombre: 'Hielo / Frío', categoria: 'bebidas', tags: ['hielo', 'frio', 'cubo'] },
  { emoji: '🥤', nombre: 'Vaso con Pitillo / Soda', categoria: 'bebidas', tags: ['refresco', 'soda', 'coca', 'pepsi', 'malta', 'pitillo', 'vaso'] },
  { emoji: '🧃', nombre: 'Jugo en Caja / Carton', categoria: 'bebidas', tags: ['jugo', 'naranja', 'manzana', 'caja', 'carton', 'pitillo'] },
  { emoji: '🍶', nombre: 'Botella de Bebida', categoria: 'bebidas', tags: ['botella', 'bebida', 'liquido'] },
  { emoji: '🥫', nombre: 'Lata / Malta / Refresco', categoria: 'bebidas', tags: ['lata', 'malta', 'refresco', 'soda', 'polar'] },
  { emoji: '☕', nombre: 'Café Caliente', categoria: 'bebidas', tags: ['cafe', 'con leche', 'negro', 'guayoyo', 'espresso', 'caliente'] },
  { emoji: '🍵', nombre: 'Té / Infusión', categoria: 'bebidas', tags: ['te', 'infusion', 'manzanilla', 'verde'] },
  { emoji: '🥛', nombre: 'Vaso de Leche / Chicha', categoria: 'bebidas', tags: ['leche', 'chicha', 'blanco', 'vaso'] },
  { emoji: '🧋', nombre: 'Té de Burbujas / Frappé', categoria: 'bebidas', tags: ['frappe', 'burbujas', 'batido', 'merengada'] },
  { emoji: '🍹', nombre: 'Bebida Tropical / Ponche', categoria: 'bebidas', tags: ['coctel', 'tropical', 'frutal', 'parchita'] },
  { emoji: '🍸', nombre: 'Jugo Especial', categoria: 'bebidas', tags: ['copa', 'jugo', 'especial'] },
  { emoji: '🧉', nombre: 'Infusión Tradicional', categoria: 'bebidas', tags: ['mate', 'hierba'] },
  { emoji: '🫖', nombre: 'Tetera / Jarra Caliente', categoria: 'bebidas', tags: ['tetera', 'jarra', 'caliente'] },
  { emoji: '⚡', nombre: 'Bebida Energética', categoria: 'bebidas', tags: ['energetica', 'gatorade', 'powerade', 'energia'] },
  { emoji: '🥥', nombre: 'Agua de Coco', categoria: 'bebidas', tags: ['coco', 'natural', 'tropical'] },
  { emoji: '🍋', nombre: 'Papelón con Limón', categoria: 'bebidas', tags: ['limonada', 'papelon', 'limon'] },

  // 🥟 COMIDAS / SALADOS
  { emoji: '🥟', nombre: 'Empanada / Pastelito', categoria: 'comidas', tags: ['empanada', 'queso', 'carne', 'pollo', 'molida', 'mechada', 'cazon'] },
  { emoji: '🧀', nombre: 'Tequeño / Ración de Tequeños', categoria: 'comidas', tags: ['tequeno', 'tequeño', 'queso', 'racion'] },
  { emoji: '🥐', nombre: 'Pastelito / Croissant', categoria: 'comidas', tags: ['pastelito', 'croissant', 'hojaldre', 'jamon'] },
  { emoji: '🥖', nombre: 'Cachito de Jamón / Baguette', categoria: 'comidas', tags: ['cachito', 'pan', 'jamon', 'baguette'] },
  { emoji: '🫓', nombre: 'Arepa / Pan Plano', categoria: 'comidas', tags: ['arepa', 'reina pepiada', 'pelua', 'sifrina', 'queso', 'asada'] },
  { emoji: '🥪', nombre: 'Sándwich Jamón y Queso', categoria: 'comidas', tags: ['sandwich', 'sanduwich', 'tostado', 'club'] },
  { emoji: '🌭', nombre: 'Perro Caliente / Hot Dog', categoria: 'comidas', tags: ['perro', 'hot dog', 'salchicha'] },
  { emoji: '🍔', nombre: 'Hamburguesa', categoria: 'comidas', tags: ['hamburguesa', 'carne', 'burger'] },
  { emoji: '🍕', nombre: 'Pizza / Slice', categoria: 'comidas', tags: ['pizza', 'porcion', 'queso', 'peperoni'] },
  { emoji: '🌯', nombre: 'Burrito / Wrap', categoria: 'comidas', tags: ['burrito', 'wrap', 'pollo'] },
  { emoji: '🌮', nombre: 'Taco', categoria: 'comidas', tags: ['taco', 'mexicano'] },
  { emoji: '🍗', nombre: 'Pollo Frito / Nuggets', categoria: 'comidas', tags: ['pollo', 'nuggets', 'crispy', 'presa'] },
  { emoji: '🥩', nombre: 'Carne / Milanesa', categoria: 'comidas', tags: ['carne', 'milanesa', 'bistec'] },
  { emoji: '🍳', nombre: 'Huevo / Omelette', categoria: 'comidas', tags: ['huevo', 'omelette', 'frito'] },
  { emoji: '🥓', nombre: 'Tocineta / Bacon', categoria: 'comidas', tags: ['tocineta', 'bacon'] },
  { emoji: '🍞', nombre: 'Pan Tostado / Tostada', categoria: 'comidas', tags: ['pan', 'tostada', 'mantequilla'] },
  { emoji: '🥗', nombre: 'Ensalada Fresca', categoria: 'comidas', tags: ['ensalada', 'verde', 'saludable'] },
  { emoji: '🍲', nombre: 'Sopa / Crema del Día', categoria: 'comidas', tags: ['sopa', 'crema', 'hervido'] },
  { emoji: '🍝', nombre: 'Pasta / Espaguetis', categoria: 'comidas', tags: ['pasta', 'espagueti', 'bolognesa'] },
  { emoji: '🍚', nombre: 'Arroz con Pollo / Bowl', categoria: 'comidas', tags: ['arroz', 'bowl', 'almuerzo'] },
  { emoji: '🌽', nombre: 'Cachapa / Mazorca', categoria: 'comidas', tags: ['cachapa', 'maiz', 'choclo', 'queso de mano'] },
  { emoji: '🥔', nombre: 'Papas Fritas', categoria: 'comidas', tags: ['papas', 'fritas', 'french fries'] },

  // 🍪 SNACKS Y DULCES
  { emoji: '🍪', nombre: 'Galleta con Chispas de Chocolate', categoria: 'snacks', tags: ['galleta', 'cookie', 'chispas', 'chocochips', 'oreo', 'maria'] },
  { emoji: '🍩', nombre: 'Dona Glaseada / Rellena', categoria: 'snacks', tags: ['dona', 'donut', 'glaseada', 'chocolate'] },
  { emoji: '🍫', nombre: 'Barra de Chocolate / Toronto', categoria: 'snacks', tags: ['chocolate', 'barra', 'toronto', 'cricri', 'savoy'] },
  { emoji: '🍰', nombre: 'Torta / Porción de Pastel', categoria: 'snacks', tags: ['torta', 'pastel', 'tres leches', 'selva negra'] },
  { emoji: '🧁', nombre: 'Ponqué / Cupcake', categoria: 'snacks', tags: ['ponque', 'cupcake', 'muffin', 'vainilla'] },
  { emoji: '🟫', nombre: 'Brownie Artesanal', categoria: 'snacks', tags: ['brownie', 'chocolate', 'nuez'] },
  { emoji: '🍨', nombre: 'Helado en Tina / Copa', categoria: 'snacks', tags: ['helado', 'copa', 'mantecado', 'fresa', 'chocolate'] },
  { emoji: '🍦', nombre: 'Barquilla / Helado Suave', categoria: 'snacks', tags: ['barquilla', 'cono', 'helado suave'] },
  { emoji: '🍧', nombre: 'Raspado / Cepillado', categoria: 'snacks', tags: ['raspado', 'cepillado', 'hielo dulce'] },
  { emoji: '🍬', nombre: 'Caramelo / Chupeta', categoria: 'snacks', tags: ['caramelo', 'dulce', 'chupeta', 'gomitas'] },
  { emoji: '🍭', nombre: 'Paleta Dulce / Chupetón', categoria: 'snacks', tags: ['paleta', 'dulce', 'chupeta'] },
  { emoji: '🍿', nombre: 'Cotufas / Palomitas de Maíz', categoria: 'snacks', tags: ['cotufas', 'palomitas', 'popcorn', 'mantequilla'] },
  { emoji: '🥜', nombre: 'Maní Salado / Frutos Secos', categoria: 'snacks', tags: ['mani', 'frutos secos', 'nueces', 'almendras'] },
  { emoji: '🍯', nombre: 'Miel / Dulce Casero', categoria: 'snacks', tags: ['miel', 'dulce'] },
  { emoji: '🍮', nombre: 'Quesillo / Flan', categoria: 'snacks', tags: ['quesillo', 'flan', 'caramelo'] },
  { emoji: '🥨', nombre: 'Pretzel Horneado', categoria: 'snacks', tags: ['pretzel', 'salado', 'dulce'] },
  { emoji: '🧇', nombre: 'Waffle con Sirope', categoria: 'snacks', tags: ['waffle', 'sirope', 'desayuno'] },

  // 🍎 FRUTAS Y SALUDABLES
  { emoji: '🍎', nombre: 'Manzana Roja', categoria: 'frutas', tags: ['manzana', 'roja', 'fruta'] },
  { emoji: '🍏', nombre: 'Manzana Verde', categoria: 'frutas', tags: ['manzana', 'verde', 'acida'] },
  { emoji: '🍌', nombre: 'Cambur / Plátano', categoria: 'frutas', tags: ['cambur', 'platano', 'banana'] },
  { emoji: '🍊', nombre: 'Naranja / Mandarina', categoria: 'frutas', tags: ['naranja', 'mandarina', 'citrico'] },
  { emoji: '🍓', nombre: 'Fresas Frescas', categoria: 'frutas', tags: ['fresas', 'fresa', 'roja'] },
  { emoji: '🍇', nombre: 'Racimo de Uvas', categoria: 'frutas', tags: ['uvas', 'uva', 'moradas'] },
  { emoji: '🍉', nombre: 'Patilla / Sandía', categoria: 'frutas', tags: ['patilla', 'sandia', 'fresca'] },
  { emoji: '🍍', nombre: 'Piña / Rodajas', categoria: 'frutas', tags: ['pina', 'piña', 'amarilla'] },
  { emoji: '🥭', nombre: 'Mango Maduro', categoria: 'frutas', tags: ['mango', 'dulce'] },
  { emoji: '🍑', nombre: 'Melocotón / Durazno', categoria: 'frutas', tags: ['durazno', 'melocoton'] },
  { emoji: '🍒', nombre: 'Cerezas', categoria: 'frutas', tags: ['cerezas', 'guindas'] },
  { emoji: '🥑', nombre: 'Aguacate', categoria: 'frutas', tags: ['aguacate', 'palta'] },

  // 📦 ÚTILES / VARIOS
  { emoji: '✏️', nombre: 'Lápiz de Grafito', categoria: 'varios', tags: ['lapiz', 'escribir', 'papeleria', 'colegio'] },
  { emoji: '🖊️', nombre: 'Bolígrafo / Lapicero', categoria: 'varios', tags: ['boligrafo', 'lapicero', 'tinta'] },
  { emoji: '📓', nombre: 'Cuaderno / Libreta', categoria: 'varios', tags: ['cuaderno', 'libreta', 'hojas'] },
  { emoji: '🎒', nombre: 'Mochila / Bolso', categoria: 'varios', tags: ['mochila', 'bolso', 'colegio'] },
  { emoji: '✂️', nombre: 'Tijeras Escolares', categoria: 'varios', tags: ['tijeras', 'cortar', 'papeleria'] },
  { emoji: '🏷️', nombre: 'Etiquetas Escolares', categoria: 'varios', tags: ['etiqueta', 'marca'] },
  { emoji: '🧻', nombre: 'Servilletas / Papel', categoria: 'varios', tags: ['servilleta', 'papel'] },
  { emoji: '🍴', nombre: 'Cubiertos Desechables', categoria: 'varios', tags: ['tenedor', 'cuchillo', 'cuchara', 'cubiertos'] },
  { emoji: '🍽️', nombre: 'Plato Cantina', categoria: 'varios', tags: ['plato', 'vajilla'] },
  { emoji: '🛍️', nombre: 'Bolsa de Papel / Cantina', categoria: 'varios', tags: ['bolsa', 'empaque'] },
  { emoji: '📦', nombre: 'Caja / Combo Escolar', categoria: 'varios', tags: ['caja', 'combo', 'pack'] },
  { emoji: '🧴', nombre: 'Gel Antibacterial / Jabón', categoria: 'varios', tags: ['antibacterial', 'gel', 'limpieza'] },
];

/**
 * Busca emojis por término de texto y/o categoría
 */
export function buscarEmojis(termino: string = '', categoria: string = 'todos'): EmojiItem[] {
  const query = termino.toLowerCase().trim();

  return CATALOGO_EMOJIS.filter((item) => {
    const coincideCategoria = categoria === 'todos' || item.categoria === categoria;
    if (!coincideCategoria) return false;

    if (!query) return true;

    return (
      item.nombre.toLowerCase().includes(query) ||
      item.emoji.includes(query) ||
      item.tags.some((tag) => tag.toLowerCase().includes(query))
    );
  });
}

/**
 * Retorna un emoji adecuado si no se seleccionó ninguno
 */
export function obtenerEmojiPorNombre(nombre?: string | null): string {
  if (!nombre) return '🍴';
  const n = nombre.toLowerCase();
  for (const item of CATALOGO_EMOJIS) {
    if (n.includes(item.nombre.toLowerCase())) return item.emoji;
    if (item.tags.some((t) => n.includes(t))) return item.emoji;
  }
  return '🍽️';
}

/**
 * Verifica si un string es una URL web válida o un emoji
 */
export function esUrlImagen(valor?: string | null): boolean {
  if (!valor) return false;
  return valor.startsWith('http://') || valor.startsWith('https://') || valor.startsWith('/');
}
