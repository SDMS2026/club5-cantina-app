export interface PrefijoTelefonico {
  codigo: string;
  pais: string;
  bandera: string;
}

export const PREFIJOS_TELEFONICOS: PrefijoTelefonico[] = [
  { codigo: '+58', pais: 'Venezuela', bandera: '🇻🇪' },
  { codigo: '+1', pais: 'EE.UU. / Canadá', bandera: '🇺🇸' },
  { codigo: '+34', pais: 'España', bandera: '🇪🇸' },
  { codigo: '+57', pais: 'Colombia', bandera: '🇨🇴' },
  { codigo: '+56', pais: 'Chile', bandera: '🇨🇱' },
  { codigo: '+54', pais: 'Argentina', bandera: '🇦🇷' },
  { codigo: '+507', pais: 'Panamá', bandera: '🇵🇦' },
  { codigo: '+52', pais: 'México', bandera: '🇲🇽' },
  { codigo: '+51', pais: 'Perú', bandera: '🇵🇪' },
  { codigo: '+55', pais: 'Brasil', bandera: '🇧🇷' },
];

export interface GrupoGrado {
  categoria: string;
  opciones: string[];
}

export const GRUPOS_GRADOS_SISTEMA: GrupoGrado[] = [
  {
    categoria: 'Preescolar / Inicial',
    opciones: [
      '1era Sala',
      '1era Sala A',
      '1era Sala B',
      '2da Sala',
      '2da Sala A',
      '2da Sala B',
      '3era Sala',
      '3era Sala A',
      '3era Sala B',
    ],
  },
  {
    categoria: 'Educación Primaria',
    opciones: [
      '1er Grado A',
      '1er Grado B',
      '2do Grado A',
      '2do Grado B',
      '3er Grado A',
      '3er Grado B',
      '4to Grado A',
      '4to Grado B',
      '5to Grado A',
      '5to Grado B',
      '6to Grado A',
      '6to Grado B',
    ],
  },
  {
    categoria: 'Educación Media / Bachillerato',
    opciones: [
      '1er Año A',
      '1er Año B',
      '2do Año A',
      '2do Año B',
      '3er Año A',
      '3er Año B',
      '4to Año A',
      '4to Año B',
      '5to Año A',
      '5to Año B',
    ],
  },
  {
    categoria: 'Personal Escolar',
    opciones: [
      'Profesor / Docente',
      'Personal Administrativo',
      'Personal Directivo',
      'Personal Obrero / Servicios',
    ],
  },
];

export interface CategoriaNivel {
  id: string;
  nombre: string;
  icono: string;
  subtitulo: string;
  opciones: string[];
}

export const CATEGORIAS_NIVELES: CategoriaNivel[] = [
  {
    id: 'preescolar',
    nombre: 'Preescolar',
    icono: '🧸',
    subtitulo: '1era, 2da y 3era Sala',
    opciones: [
      '1era Sala',
      '1era Sala A',
      '1era Sala B',
      '2da Sala',
      '2da Sala A',
      '2da Sala B',
      '3era Sala',
      '3era Sala A',
      '3era Sala B',
    ],
  },
  {
    id: 'primaria',
    nombre: 'Primaria',
    icono: '📚',
    subtitulo: '1er a 6to Grado',
    opciones: [
      '1er Grado A',
      '1er Grado B',
      '2do Grado A',
      '2do Grado B',
      '3er Grado A',
      '3er Grado B',
      '4to Grado A',
      '4to Grado B',
      '5to Grado A',
      '5to Grado B',
      '6to Grado A',
      '6to Grado B',
    ],
  },
  {
    id: 'bachillerato',
    nombre: 'Bachillerato',
    icono: '🎓',
    subtitulo: '1er a 5to Año',
    opciones: [
      '1er Año A',
      '1er Año B',
      '2do Año A',
      '2do Año B',
      '3er Año A',
      '3er Año B',
      '4to Año A',
      '4to Año B',
      '5to Año A',
      '5to Año B',
    ],
  },
  {
    id: 'personal',
    nombre: 'Personal / Padres',
    icono: '💼',
    subtitulo: 'Docentes, Representantes y Personal',
    opciones: [
      'Profesor / Docente',
      'Representante / Padre de Familia',
      'Personal Administrativo',
      'Personal Directivo',
      'Personal Obrero / Servicios',
    ],
  },
];

export const SECCIONES_PREDETERMINADAS = ['A', 'B', 'C', 'D', 'E'];

export interface CategoriaDosPasos {
  id: 'preescolar' | 'primaria' | 'bachillerato' | 'personal';
  nombre: string;
  icono: string;
  subtitulo: string;
  gradosBase: string[];
  requiereSeccion: boolean;
}

export const CATEGORIAS_DOS_PASOS: CategoriaDosPasos[] = [
  {
    id: 'preescolar',
    nombre: 'Preescolar',
    icono: '🧸',
    subtitulo: 'Salas Iniciales',
    gradosBase: ['1era Sala', '2da Sala', '3era Sala'],
    requiereSeccion: true,
  },
  {
    id: 'primaria',
    nombre: 'Primaria',
    icono: '📚',
    subtitulo: '1er a 6to Grado',
    gradosBase: [
      '1er Grado',
      '2do Grado',
      '3er Grado',
      '4to Grado',
      '5to Grado',
      '6to Grado',
    ],
    requiereSeccion: true,
  },
  {
    id: 'bachillerato',
    nombre: 'Bachillerato',
    icono: '🎓',
    subtitulo: '1er a 5to Año',
    gradosBase: [
      '1er Año',
      '2do Año',
      '3er Año',
      '4to Año',
      '5to Año',
    ],
    requiereSeccion: true,
  },
  {
    id: 'personal',
    nombre: 'Personal / Padres',
    icono: '💼',
    subtitulo: 'Docentes y Representantes',
    gradosBase: [
      'Profesor / Docente',
      'Representante / Padre de Familia',
      'Personal Administrativo',
      'Personal Directivo',
      'Personal Obrero / Servicios',
    ],
    requiereSeccion: false,
  },
];

export function separarGradoYSeccion(gradoCompleto?: string | null): {
  gradoBase: string;
  seccion: string;
  esPersonal: boolean;
} {
  if (!gradoCompleto || !gradoCompleto.trim()) {
    return { gradoBase: '1er Grado', seccion: 'A', esPersonal: false };
  }

  const trimmed = gradoCompleto.trim();
  if (esProfesorOPersonal(trimmed) || esRepresentante(trimmed)) {
    return { gradoBase: trimmed, seccion: '', esPersonal: true };
  }

  // Comprobar si termina con letra de sección (ej: "1er Grado B", "1era Sala A", "5to Año E")
  const match = trimmed.match(/^(.*?)\s+([A-Za-z])$/);
  if (match) {
    return {
      gradoBase: match[1].trim(),
      seccion: match[2].toUpperCase(),
      esPersonal: false,
    };
  }

  return { gradoBase: trimmed, seccion: '', esPersonal: false };
}

export function obtenerCategoriaDeGrado(grado?: string | null): string {
  if (!grado) return 'primaria';
  for (const cat of CATEGORIAS_NIVELES) {
    if (cat.opciones.includes(grado)) return cat.id;
  }
  for (const cat of CATEGORIAS_DOS_PASOS) {
    if (cat.gradosBase.some((gb) => grado.startsWith(gb))) return cat.id;
  }
  if (esProfesorOPersonal(grado) || esRepresentante(grado)) return 'personal';
  return 'primaria';
}

export const TODOS_LOS_GRADOS_SISTEMA: string[] = CATEGORIAS_NIVELES.flatMap((g) => g.opciones);

/**
 * Determina si el grado/sección corresponde a un representante / padre de familia
 */
export function esRepresentante(gradoSeccion?: string | null): boolean {
  if (!gradoSeccion) return false;
  const lower = gradoSeccion.toLowerCase();
  return (
    lower.includes('representante') ||
    lower.includes('padre') ||
    lower.includes('madre') ||
    lower.includes('apoderad') ||
    lower.includes('familiar')
  );
}

/**
 * Determina si el grado/sección corresponde a un profesor o personal escolar
 */
export function esProfesorOPersonal(gradoSeccion?: string | null): boolean {
  if (!gradoSeccion) return false;
  const lower = gradoSeccion.toLowerCase();
  return (
    lower.includes('profesor') ||
    lower.includes('docente') ||
    lower.includes('personal') ||
    lower.includes('directiv') ||
    lower.includes('maestr')
  );
}

/**
 * Determina si es un adulto (profesor, personal o representante) o un estudiante
 */
export function esAdultoOPersonal(gradoSeccion?: string | null): boolean {
  return esProfesorOPersonal(gradoSeccion) || esRepresentante(gradoSeccion);
}

/**
 * Separa un teléfono guardado (ej: "+58 4125404830" o "04125404830")
 * en prefijo y número local de hasta 10 dígitos
 */
export function separarTelefonoPrefijo(telefono?: string | null): {
  prefijo: string;
  numero: string;
} {
  if (!telefono || !telefono.trim()) {
    return { prefijo: '+58', numero: '' };
  }

  const tel = telefono.trim();

  // Buscar coincidencia con prefijos conocidos
  for (const p of PREFIJOS_TELEFONICOS) {
    if (tel.startsWith(p.codigo)) {
      const resto = tel.slice(p.codigo.length).replace(/\D/g, '').slice(0, 10);
      return { prefijo: p.codigo, numero: resto };
    }
  }

  // Si tiene código internacional no registrado con +
  if (tel.startsWith('+')) {
    const match = tel.match(/^(\+\d{1,4})\s*(.*)$/);
    if (match) {
      return {
        prefijo: match[1],
        numero: match[2].replace(/\D/g, '').slice(0, 10),
      };
    }
  }

  // Si es un número venezolano sin +58 (ej: 04121234567 o 4121234567)
  const soloDigitos = tel.replace(/\D/g, '');
  if (soloDigitos.startsWith('58') && soloDigitos.length >= 12) {
    return { prefijo: '+58', numero: soloDigitos.slice(2, 12) };
  }

  // Quitar el 0 inicial si existe para ajustarse a 10 dígitos (ej: 04125404830 -> 4125404830)
  if (soloDigitos.startsWith('0') && soloDigitos.length === 11) {
    return { prefijo: '+58', numero: soloDigitos.slice(1, 11) };
  }

  return { prefijo: '+58', numero: soloDigitos.slice(0, 10) };
}

/**
 * Combina prefijo y número para guardar en base de datos
 */
export function unirTelefonoPrefijo(prefijo: string, numero: string): string | null {
  const numLimpio = numero.replace(/\D/g, '').slice(0, 10);
  if (!numLimpio) return null;
  return `${prefijo} ${numLimpio}`;
}

export interface VinculoCliente {
  id: string;
  nombre: string;
  grado_seccion?: string | null;
  tipo: 'padre' | 'hijo' | 'hermano';
  relacionTexto: string;
}

/**
 * Detecta si un estudiante está vinculado con un representante/padre registrado en el sistema
 * o con hermanos / hijos basándose EXCLUSIVAMENTE en el número de teléfono WhatsApp,
 * evitando cualquier falso positivo por personas con nombres o apellidos iguales.
 */
export function encontrarVinculosCliente(
  cliente: {
    id?: string;
    nombre_estudiante: string;
    grado_seccion?: string | null;
    nombre_representante?: string | null;
    telefono_whatsapp?: string | null;
  },
  todosClientes: {
    id: string;
    nombre_estudiante: string;
    grado_seccion?: string | null;
    nombre_representante?: string | null;
    telefono_whatsapp?: string | null;
  }[]
): VinculoCliente[] {
  if (!cliente) return [];

  const telCliente = (cliente.telefono_whatsapp || '').replace(/\D/g, '');
  // La vinculación se basa EXCLUSIVAMENTE en el número de teléfono (mínimo 7 dígitos)
  if (telCliente.length < 7) {
    return [];
  }

  const esAdulto = esAdultoOPersonal(cliente.grado_seccion);
  const vinculos: VinculoCliente[] = [];

  for (const otro of todosClientes) {
    if (cliente.id && otro.id === cliente.id) continue;
    const telOtro = (otro.telefono_whatsapp || '').replace(/\D/g, '');
    if (telOtro.length < 7) continue;

    const mismoTelefono =
      telCliente === telOtro ||
      telCliente.endsWith(telOtro.slice(-8)) ||
      telOtro.endsWith(telCliente.slice(-8));

    if (!mismoTelefono) continue;

    const otroEsAdulto = esAdultoOPersonal(otro.grado_seccion);

    // Si el cliente actual es estudiante:
    if (!esAdulto) {
      if (otroEsAdulto) {
        vinculos.push({
          id: otro.id,
          nombre: otro.nombre_estudiante,
          grado_seccion: otro.grado_seccion,
          tipo: 'padre',
          relacionTexto: `Padre / Representante: ${otro.nombre_estudiante}`,
        });
      } else {
        vinculos.push({
          id: otro.id,
          nombre: otro.nombre_estudiante,
          grado_seccion: otro.grado_seccion,
          tipo: 'hermano',
          relacionTexto: `Hermano(a): ${otro.nombre_estudiante} (${otro.grado_seccion || 'Sin sección'})`,
        });
      }
    } else {
      // Si el cliente actual es padre/representante o profesor:
      if (!otroEsAdulto) {
        vinculos.push({
          id: otro.id,
          nombre: otro.nombre_estudiante,
          grado_seccion: otro.grado_seccion,
          tipo: 'hijo',
          relacionTexto: `Hijo(a) / Alumno(a): ${otro.nombre_estudiante} (${otro.grado_seccion || 'Sin sección'})`,
        });
      } else {
        vinculos.push({
          id: otro.id,
          nombre: otro.nombre_estudiante,
          grado_seccion: otro.grado_seccion,
          tipo: 'padre',
          relacionTexto: `Familiar / Co-representante: ${otro.nombre_estudiante}`,
        });
      }
    }
  }

  return vinculos;
}
