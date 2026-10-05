'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings,
  MessageCircle,
  Users,
  Smartphone,
  Building2,
  CreditCard,
  Check,
  Copy,
  RotateCcw,
  Save,
  Menu,
  Info,
  Sparkles,
  Download,
  Upload,
  CheckCheck,
  FileText,
  Sliders,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { useSidebar } from '@/components/SidebarContext';
import {
  SistemaConfig,
  PlantillasWhatsAppConfig,
  DatosPagoMovilConfig,
  DEFAULT_CONFIG,
  DEFAULT_PLANTILLA_INDIVIDUAL,
  DEFAULT_PLANTILLA_FAMILIAR,
  DEFAULT_PLANTILLA_ESTUDIANTE,
  obtenerConfiguracion,
  guardarConfiguracion,
  restablecerPlantilla,
  restablecerTodaLaConfiguracion,
  compilarPlantilla,
  sincronizarDesdeSupabase,
  EVENTO_CONFIG_ACTUALIZADA,
} from '@/lib/whatsappConfig';

type TabActiva = 'whatsapp' | 'pagomovil' | 'sistema';
type TipoPlantilla = keyof PlantillasWhatsAppConfig;

// Variables disponibles por tipo de plantilla con descripción amigable
interface VariableInfo {
  clave: string;
  etiqueta: string;
  descripcion: string;
  ejemplo: string;
}

const VARIABLES_INDIVIDUAL: VariableInfo[] = [
  { clave: 'nombre_cantina', etiqueta: 'Nombre Cantina', descripcion: 'Nombre del negocio/cantina', ejemplo: 'Club 5 Cantina Escolar' },
  { clave: 'representante', etiqueta: 'Representante', descripcion: 'Nombre del representante o contacto', ejemplo: 'María González' },
  { clave: 'estudiante', etiqueta: 'Estudiante', descripcion: 'Nombre del estudiante o profesor', ejemplo: 'Santiago González' },
  { clave: 'grado', etiqueta: 'Grado/Sección', descripcion: 'Grado entre paréntesis si aplica', ejemplo: '(4to Grado A)' },
  { clave: 'cantidad_consumos', etiqueta: 'Cant. Consumos', descripcion: 'Número total de fiados acumulados', ejemplo: '3' },
  { clave: 'detalle_consumos', etiqueta: 'Detalle Consumos', descripcion: 'Desglose detallado con fechas y productos', ejemplo: '*Consumo #1 (04 oct)* - $4.00:\n    - 2x Empanada de Pollo ($4.00)' },
  { clave: 'total_usd', etiqueta: 'Total en $ USD', descripcion: 'Monto total adeudado en dólares', ejemplo: '$10.50' },
  { clave: 'total_bs', etiqueta: 'Total en Bs.', descripcion: 'Monto total convertido a Bolívares', ejemplo: 'Bs. 525,00' },
  { clave: 'tasa_bcv', etiqueta: 'Tasa BCV', descripcion: 'Tasa oficial BCV del día', ejemplo: 'Bs. 50,00' },
  { clave: 'banco', etiqueta: 'Banco Pago Móvil', descripcion: 'Banco configurado para recibir transferencias', ejemplo: 'BNC (Banco Nacional de Crédito - 0191)' },
  { clave: 'cedula', etiqueta: 'Cédula / RIF', descripcion: 'Cédula registrada para el Pago Móvil', ejemplo: '14953511' },
  { clave: 'telefono_pagomovil', etiqueta: 'Tel. Pago Móvil', descripcion: 'Número telefónico del Pago Móvil', ejemplo: '04125404830' },
  { clave: 'telefono_reporte', etiqueta: 'Tel. Reporte Captures', descripcion: 'WhatsApp donde envían el comprobante', ejemplo: '04123588848' },
  { clave: 'nota_efectivo', etiqueta: 'Nota Efectivo', descripcion: 'Indicación de pago en efectivo', ejemplo: 'Directamente en caja de cantina ($ o Bs.)' },
];

const VARIABLES_FAMILIAR: VariableInfo[] = [
  { clave: 'nombre_cantina', etiqueta: 'Nombre Cantina', descripcion: 'Nombre del negocio/cantina', ejemplo: 'Club 5 Cantina Escolar' },
  { clave: 'representante', etiqueta: 'Representante / Familia', descripcion: 'Nombre del representante o familia', ejemplo: 'Familia González Pérez' },
  { clave: 'cantidad_estudiantes', etiqueta: 'Cant. Hijos/Estudiantes', descripcion: 'Número de estudiantes agrupados', ejemplo: '2' },
  { clave: 'resumen_familiar', etiqueta: 'Resumen Familiar', descripcion: 'Lista compacta de cada hijo y su total', ejemplo: '- Santiago (4to Grado A): $6.00 (Bs. 300,00)\n- Camila (1er Grado B): $4.50 (Bs. 225,00)' },
  { clave: 'desglose_estudiantes', etiqueta: 'Desglose por Estudiante', descripcion: 'Consumos completos separados por estudiante', ejemplo: '*👤 Santiago* (4to Grado A) - *Total: $6.00*:\n  • *Consumo #1* - $6.00...\n\n------------------\n\n*👤 Camila* (1er Grado B) - *Total: $4.50*...' },
  { clave: 'total_usd', etiqueta: 'Gran Total en $ USD', descripcion: 'Suma de las deudas de todos los hijos en USD', ejemplo: '$10.50' },
  { clave: 'total_bs', etiqueta: 'Gran Total en Bs.', descripcion: 'Suma consolidada convertida a Bolívares', ejemplo: 'Bs. 525,00' },
  { clave: 'tasa_bcv', etiqueta: 'Tasa BCV', descripcion: 'Tasa oficial BCV del día', ejemplo: 'Bs. 50,00' },
  { clave: 'banco', etiqueta: 'Banco Pago Móvil', descripcion: 'Banco configurado para recibir transferencias', ejemplo: 'BNC (Banco Nacional de Crédito - 0191)' },
  { clave: 'cedula', etiqueta: 'Cédula / RIF', descripcion: 'Cédula registrada para el Pago Móvil', ejemplo: '14953511' },
  { clave: 'telefono_pagomovil', etiqueta: 'Tel. Pago Móvil', descripcion: 'Número telefónico del Pago Móvil', ejemplo: '04125404830' },
  { clave: 'telefono_reporte', etiqueta: 'Tel. Reporte Captures', descripcion: 'WhatsApp donde envían el comprobante', ejemplo: '04123588848' },
  { clave: 'nota_efectivo', etiqueta: 'Nota Efectivo', descripcion: 'Indicación de pago en efectivo', ejemplo: 'Directamente en caja de cantina ($ o Bs.)' },
];

const VARIABLES_ESTUDIANTE: VariableInfo[] = [
  { clave: 'nombre_cantina', etiqueta: 'Nombre Cantina', descripcion: 'Nombre del negocio/cantina', ejemplo: 'Club 5 Cantina Escolar' },
  { clave: 'destinatario', etiqueta: 'Destinatario', descripcion: 'Nombre del representante, profesor o alumno', ejemplo: 'María González' },
  { clave: 'sujeto', etiqueta: 'Sujeto', descripcion: 'Referencia al titular o hijo', ejemplo: 'el estudiante Santiago González' },
  { clave: 'estudiante', etiqueta: 'Estudiante', descripcion: 'Nombre del estudiante', ejemplo: 'Santiago González' },
  { clave: 'grado', etiqueta: 'Grado/Sección', descripcion: 'Grado entre paréntesis si aplica', ejemplo: '(4to Grado A)' },
  { clave: 'estado_cuenta', etiqueta: 'Estado de Cuenta', descripcion: 'Texto dinámico de saldo pendiente o a favor', ejemplo: 'Le recordamos amablemente que presenta un saldo pendiente de $10.50 (Bs. 525,00 a tasa oficial BCV: Bs. 50,00).' },
  { clave: 'saldo_usd', etiqueta: 'Saldo USD', descripcion: 'Monto de la deuda o saldo a favor en USD', ejemplo: '$10.50' },
  { clave: 'saldo_bs', etiqueta: 'Saldo Bs.', descripcion: 'Monto del saldo convertido a Bolívares', ejemplo: 'Bs. 525,00' },
  { clave: 'tasa_bcv', etiqueta: 'Tasa BCV', descripcion: 'Tasa oficial BCV del día', ejemplo: 'Bs. 50,00' },
  { clave: 'telefono_reporte', etiqueta: 'Tel. Cantina', descripcion: 'Teléfono de contacto de la cantina', ejemplo: '04123588848' },
];

export default function ConfiguracionPage() {
  const { toggleSidebar, abierto: sidebarAbierto } = useSidebar();

  const [tabActiva, setTabActiva] = useState<TabActiva>('whatsapp');
  const [tipoPlantilla, setTipoPlantilla] = useState<TipoPlantilla>('individual');

  const [config, setConfig] = useState<SistemaConfig>(DEFAULT_CONFIG);
  const [guardado, setGuardado] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [notificacion, setNotificacion] = useState<{ tipo: 'exito' | 'info' | 'error'; mensaje: string } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cargar configuración al montar y suscribirse a cambios
  useEffect(() => {
    const cargada = obtenerConfiguracion();
    setConfig(cargada);

    // Intentar sincronización con Supabase en segundo plano
    sincronizarDesdeSupabase().then((remota) => {
      setConfig(remota);
    });

    const handler = (e: Event) => {
      const custom = e as CustomEvent<SistemaConfig>;
      if (custom.detail) {
        setConfig(custom.detail);
      }
    };

    window.addEventListener(EVENTO_CONFIG_ACTUALIZADA, handler);
    return () => window.removeEventListener(EVENTO_CONFIG_ACTUALIZADA, handler);
  }, []);

  const mostrarNotificacion = (tipo: 'exito' | 'info' | 'error', mensaje: string) => {
    setNotificacion({ tipo, mensaje });
    setTimeout(() => setNotificacion(null), 4000);
  };

  const handleGuardar = () => {
    guardarConfiguracion(config);
    setGuardado(true);
    mostrarNotificacion('exito', '¡Configuración guardada y actualizada en toda la cantina!');
    setTimeout(() => setGuardado(false), 2500);
  };

  // Atajo de teclado Ctrl+S / Cmd+S para guardar rápidamente
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleGuardar();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [config]);

  // Insertar variable en la posición del cursor dentro del textarea
  const handleInsertarVariable = (clave: string) => {
    const token = `{${clave}}`;
    const textarea = textareaRef.current;
    if (!textarea) {
      // Si no hay referencia, simplemente concatenar
      const actual = config.plantillas[tipoPlantilla];
      setConfig((prev) => ({
        ...prev,
        plantillas: {
          ...prev.plantillas,
          [tipoPlantilla]: actual + ' ' + token,
        },
      }));
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const actual = config.plantillas[tipoPlantilla];
    const nuevoTexto = actual.substring(0, start) + token + actual.substring(end);

    setConfig((prev) => ({
      ...prev,
      plantillas: {
        ...prev.plantillas,
        [tipoPlantilla]: nuevoTexto,
      },
    }));

    // Reposicionar el cursor después de la variable insertada
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + token.length, start + token.length);
    }, 50);
  };

  // Restablecer la plantilla actual a su valor original
  const handleRestablecerPlantillaActual = () => {
    if (
      !confirm(
        '¿Deseas restablecer esta plantilla a su texto predeterminado original de Club 5?'
      )
    ) {
      return;
    }

    const valorOriginal = DEFAULT_CONFIG.plantillas[tipoPlantilla];
    setConfig((prev) => ({
      ...prev,
      plantillas: {
        ...prev.plantillas,
        [tipoPlantilla]: valorOriginal,
      },
    }));
    mostrarNotificacion('info', 'Plantilla restablecida a la versión original. Recuerda hacer clic en Guardar.');
  };

  // Copiar el texto de la vista previa al portapapeles
  const handleCopiarVistaPrevia = (texto: string) => {
    navigator.clipboard.writeText(texto);
    setCopiado(true);
    mostrarNotificacion('exito', '¡Mensaje de vista previa copiado al portapapeles!');
    setTimeout(() => setCopiado(false), 2000);
  };

  // Exportar configuración a un archivo JSON
  const handleExportarConfig = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(config, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `club5_configuracion_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    mostrarNotificacion('exito', 'Archivo de configuración exportado correctamente.');
  };

  // Importar configuración desde JSON
  const handleImportarConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const contenido = JSON.parse(event.target?.result as string);
        if (contenido && contenido.plantillas && contenido.pagoMovil) {
          guardarConfiguracion(contenido);
          setConfig(contenido);
          mostrarNotificacion('exito', '¡Configuración restaurada con éxito desde el archivo!');
        } else {
          mostrarNotificacion('error', 'El archivo no tiene el formato de configuración válido de Club 5.');
        }
      } catch (err) {
        mostrarNotificacion('error', 'Error al leer el archivo JSON seleccionado.');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Restablecer toda la configuración a fábrica
  const handleRestablecerTodo = () => {
    if (
      !confirm(
        '¿Estás seguro de restablecer TODA la configuración del sistema (mensajes, datos bancarios y preferencias) a los valores originales de fábrica?'
      )
    ) {
      return;
    }
    const restablecida = restablecerTodaLaConfiguracion();
    setConfig(restablecida);
    mostrarNotificacion('info', 'Todas las opciones fueron restablecidas a su valor de fábrica.');
  };

  // Generar vista previa con datos simulados según la plantilla activa
  const generarVistaPrevia = (): string => {
    const pago = config.pagoMovil;
    const plantilla = config.plantillas[tipoPlantilla];

    if (tipoPlantilla === 'individual') {
      const vars: Record<string, string> = {
        nombre_cantina: pago.nombre_cantina,
        representante: 'María González',
        estudiante: 'Santiago González',
        grado: '(4to Grado A)',
        cantidad_consumos: '2',
        detalle_consumos:
          '*Consumo #1 (02 oct)* - $4.00:\n    - 2x Empanada de Pollo ($4.00)\n\n*Consumo #2 (04 oct)* - $6.50:\n    - 1x Malta Polar ($2.00)\n    - 1x Sandwich Mixto ($4.50)',
        total_usd: '$10.50',
        total_bs: 'Bs. 525,00',
        tasa_bcv: 'Bs. 50,00',
        banco: pago.banco,
        cedula: pago.cedula,
        telefono_pagomovil: pago.telefono_pagomovil,
        telefono_reporte: pago.telefono_reporte,
        nota_efectivo: pago.nota_efectivo,
      };
      return compilarPlantilla(plantilla, vars);
    }

    if (tipoPlantilla === 'familiar') {
      const vars: Record<string, string> = {
        nombre_cantina: pago.nombre_cantina,
        representante: 'Familia González Pérez',
        cantidad_estudiantes: '2',
        resumen_familiar:
          '- Santiago (4to Grado A): $6.00 (Bs. 300,00)\n- Camila (1er Grado B): $4.50 (Bs. 225,00)',
        desglose_estudiantes:
          '*👤 Santiago* (4to Grado A) - *Total: $6.00* (1 consumo):\n  • *Consumo #1 (04 oct)* - $6.00:\n    - 1x Hamburguesa Especial ($6.00)\n\n------------------\n\n*👤 Camila* (1er Grado B) - *Total: $4.50* (1 consumo):\n  • *Consumo #1 (04 oct)* - $4.50:\n    - 1x Croissant de Jamón ($4.50)',
        total_usd: '$10.50',
        total_bs: 'Bs. 525,00',
        tasa_bcv: 'Bs. 50,00',
        banco: pago.banco,
        cedula: pago.cedula,
        telefono_pagomovil: pago.telefono_pagomovil,
        telefono_reporte: pago.telefono_reporte,
        nota_efectivo: pago.nota_efectivo,
      };
      return compilarPlantilla(plantilla, vars);
    }

    if (tipoPlantilla === 'estudiante') {
      const vars: Record<string, string> = {
        nombre_cantina: pago.nombre_cantina,
        destinatario: 'María González',
        sujeto: 'el estudiante Santiago González',
        estudiante: 'Santiago González',
        grado: '(4to Grado A)',
        estado_cuenta:
          'Le recordamos amablemente que presenta un saldo pendiente de $10.50 (Bs. 525,00 a tasa oficial BCV: Bs. 50,00).',
        saldo_usd: '$10.50',
        saldo_bs: 'Bs. 525,00',
        tasa_bcv: 'Bs. 50,00',
        telefono_reporte: pago.telefono_reporte,
      };
      return compilarPlantilla(plantilla, vars);
    }

    return '';
  };

  // Convertir texto con markdown ligero de WhatsApp (*bold*) a JSX para vista previa
  const formatearTextoWhatsApp = (texto: string) => {
    const lineas = texto.split('\n');
    return lineas.map((linea, index) => {
      // Reemplazo de *negrita* por <strong>
      const partes = linea.split(/(\*[^*]+\*)/g);
      return (
        <span key={index} className="block min-h-[1.2em]">
          {partes.map((parte, pIdx) => {
            if (parte.startsWith('*') && parte.endsWith('*') && parte.length > 2) {
              return (
                <strong key={pIdx} className="font-bold text-gray-900 dark:text-white">
                  {parte.slice(1, -1)}
                </strong>
              );
            }
            return <span key={pIdx}>{parte}</span>;
          })}
        </span>
      );
    });
  };

  const variablesActuales =
    tipoPlantilla === 'individual'
      ? VARIABLES_INDIVIDUAL
      : tipoPlantilla === 'familiar'
      ? VARIABLES_FAMILIAR
      : VARIABLES_ESTUDIANTE;

  const textoVistaPrevia = generarVistaPrevia();

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAFA] dark:bg-[#090D16] text-slate-900 dark:text-slate-100 transition-colors w-full max-w-full overflow-x-hidden">
      {/* Toast de Notificaciones */}
      <AnimatePresence>
        {notificacion && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`fixed top-4 right-4 z-50 flex items-center gap-2.5 rounded-2xl px-4 py-3 text-xs font-semibold shadow-xl border ${
              notificacion.tipo === 'exito'
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-500/20'
                : notificacion.tipo === 'error'
                ? 'bg-rose-600 text-white border-rose-500 shadow-rose-500/20'
                : 'bg-indigo-600 text-white border-indigo-500 shadow-indigo-500/20'
            }`}
          >
            {notificacion.tipo === 'exito' && <Check className="h-4 w-4" />}
            {notificacion.tipo === 'error' && <AlertCircle className="h-4 w-4" />}
            {notificacion.tipo === 'info' && <Info className="h-4 w-4" />}
            <span>{notificacion.mensaje}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Sticky */}
      <header className="sticky top-0 z-40 w-full border-b border-gray-200/80 dark:border-slate-800 bg-white/90 dark:bg-[#0D111A]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-3 py-2 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Botón Hamburguesa */}
            <button
              type="button"
              onClick={toggleSidebar}
              className={`h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl border border-gray-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-200 shadow-2xs hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400 transition active:scale-95 ${
                !sidebarAbierto ? 'flex' : 'flex md:hidden'
              }`}
              title="Abrir menú de navegación"
              aria-label="Abrir barra lateral"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900/50 text-indigo-700 dark:text-indigo-400 shadow-xs">
              <Settings className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-lg font-bold tracking-tight text-gray-900 dark:text-white truncate">
                  Configuración del Sistema
                </h1>
                <span className="rounded-full border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 dark:text-indigo-300">
                  Club 5
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-gray-500 dark:text-slate-400 hidden sm:block truncate">
                Edición de mensajes de WhatsApp, datos de Pago Móvil y preferencias generales
              </p>
            </div>
          </div>

          {/* Botón Guardar Cambios */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleGuardar}
              className={`flex items-center gap-2 rounded-xl sm:rounded-2xl px-4 py-2 text-xs font-bold shadow-xs transition active:scale-95 ${
                guardado
                  ? 'bg-emerald-600 text-white'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
              }`}
              title="Guardar todos los cambios (Ctrl + S)"
            >
              {guardado ? (
                <>
                  <Check className="h-4 w-4" />
                  <span>¡Guardado!</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span className="hidden sm:inline">Guardar Cambios</span>
                  <span className="sm:hidden">Guardar</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Contenido Principal */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-3 sm:px-6 lg:px-8 py-5">
        {/* Navegación por Pestañas */}
        <div className="flex items-center gap-1.5 sm:gap-2 border-b border-gray-200 dark:border-slate-800 pb-3 mb-6 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setTabActiva('whatsapp')}
            className={`flex items-center gap-2 rounded-xl sm:rounded-2xl px-3.5 py-2 text-xs font-bold transition whitespace-nowrap ${
              tabActiva === 'whatsapp'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800'
            }`}
          >
            <MessageCircle className="h-4 w-4" />
            <span>Mensajes de WhatsApp</span>
          </button>

          <button
            type="button"
            onClick={() => setTabActiva('pagomovil')}
            className={`flex items-center gap-2 rounded-xl sm:rounded-2xl px-3.5 py-2 text-xs font-bold transition whitespace-nowrap ${
              tabActiva === 'pagomovil'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800'
            }`}
          >
            <CreditCard className="h-4 w-4" />
            <span>Datos de Pago Móvil & Negocio</span>
          </button>

          <button
            type="button"
            onClick={() => setTabActiva('sistema')}
            className={`flex items-center gap-2 rounded-xl sm:rounded-2xl px-3.5 py-2 text-xs font-bold transition whitespace-nowrap ${
              tabActiva === 'sistema'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800'
            }`}
          >
            <Sliders className="h-4 w-4" />
            <span>Ajustes & Respaldo</span>
          </button>
        </div>

        {/* PESTAÑA 1: MENSAJES DE WHATSAPP */}
        {tabActiva === 'whatsapp' && (
          <div className="space-y-6">
            {/* Selector de Tipo de Mensaje */}
            <div className="rounded-2xl border border-gray-200/90 dark:border-slate-800 bg-white dark:bg-[#0D111A] p-4 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                <div>
                  <h2 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <MessageCircle className="h-4 w-4 text-emerald-600" />
                    Selecciona la Plantilla a Personalizar
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    Edita el texto exacto que enviará la encargada a los representantes por WhatsApp.
                  </p>
                </div>

                <div className="flex items-center gap-1.5 p-1 rounded-xl bg-gray-100 dark:bg-slate-900 border border-gray-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setTipoPlantilla('individual')}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                      tipoPlantilla === 'individual'
                        ? 'bg-white dark:bg-[#111726] text-emerald-700 dark:text-emerald-400 shadow-2xs font-bold'
                        : 'text-gray-600 dark:text-slate-400 hover:text-gray-900'
                    }`}
                  >
                    👤 Cobro Individual
                  </button>

                  <button
                    type="button"
                    onClick={() => setTipoPlantilla('familiar')}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                      tipoPlantilla === 'familiar'
                        ? 'bg-white dark:bg-[#111726] text-purple-700 dark:text-purple-400 shadow-2xs font-bold'
                        : 'text-gray-600 dark:text-slate-400 hover:text-gray-900'
                    }`}
                  >
                    👨‍👩‍👧‍👦 Cobro Familiar
                  </button>

                  <button
                    type="button"
                    onClick={() => setTipoPlantilla('estudiante')}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                      tipoPlantilla === 'estudiante'
                        ? 'bg-white dark:bg-[#111726] text-indigo-700 dark:text-indigo-400 shadow-2xs font-bold'
                        : 'text-gray-600 dark:text-slate-400 hover:text-gray-900'
                    }`}
                  >
                    📋 Aviso Directorio
                  </button>
                </div>
              </div>

              {/* Banner Informativo del Tipo Seleccionado */}
              <div className="rounded-xl border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50/60 dark:bg-emerald-950/20 p-3 text-xs text-emerald-900 dark:text-emerald-300 flex items-start gap-2.5">
                <Sparkles className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                <div>
                  <span className="font-bold">
                    {tipoPlantilla === 'individual' && 'Cobro Individual (Módulo Cuentas por Cobrar): '}
                    {tipoPlantilla === 'familiar' && 'Reporte Familiar Consolidado (Módulo Cuentas por Cobrar): '}
                    {tipoPlantilla === 'estudiante' && 'Aviso de Estado de Cuenta (Módulo Directorio de Estudiantes): '}
                  </span>
                  <span>
                    {tipoPlantilla === 'individual' &&
                      'Se genera al pulsar el botón verde de WhatsApp en la tarjeta o fila de un estudiante con consumos pendientes.'}
                    {tipoPlantilla === 'familiar' &&
                      'Se genera automáticamente cuando un representante tiene 2 o más estudiantes vinculados, agrupando los consumos en un solo mensaje profesional.'}
                    {tipoPlantilla === 'estudiante' &&
                      'Se genera al presionar WhatsApp en el directorio de estudiantes para avisar saldo a favor, solvente o deuda general.'}
                  </span>
                </div>
              </div>
            </div>

            {/* Layout de 2 Columnas: Editor a la Izquierda, Vista Previa WhatsApp a la Derecha */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Columna Izquierda: Editor y Variables (7 cols) */}
              <div className="lg:col-span-7 space-y-4">
                {/* Caja de Variables Dinámicas (Chips interactivos) */}
                <div className="rounded-2xl border border-gray-200/90 dark:border-slate-800 bg-white dark:bg-[#0D111A] p-4 shadow-2xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                      Variables Dinámicas Disponibles (Haz clic para insertar):
                    </span>
                    <span className="text-[10px] text-gray-400">Inserta en la posición del cursor</span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {variablesActuales.map((v) => (
                      <button
                        key={v.clave}
                        type="button"
                        onClick={() => handleInsertarVariable(v.clave)}
                        title={`${v.descripcion} (Ejemplo: ${v.ejemplo})`}
                        className="group flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50/80 dark:bg-slate-800/80 px-2 py-1 text-[11px] font-mono text-gray-700 dark:text-slate-300 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 dark:hover:text-emerald-300 transition active:scale-95"
                      >
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold group-hover:scale-110 transition-transform">
                          +
                        </span>
                        <span>{`{${v.clave}}`}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Editor Textarea */}
                <div className="rounded-2xl border border-gray-200/90 dark:border-slate-800 bg-white dark:bg-[#0D111A] p-4 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-emerald-600" />
                      Texto de la Plantilla:
                    </label>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleRestablecerPlantillaActual}
                        className="flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:underline"
                        title="Volver al texto predeterminado original"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Restablecer original
                      </button>
                    </div>
                  </div>

                  <textarea
                    ref={textareaRef}
                    rows={15}
                    value={config.plantillas[tipoPlantilla]}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        plantillas: {
                          ...prev.plantillas,
                          [tipoPlantilla]: e.target.value,
                        },
                      }))
                    }
                    placeholder="Escribe el mensaje de WhatsApp aquí..."
                    className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-gray-50/60 dark:bg-[#111726] p-3 text-xs font-mono text-gray-900 dark:text-slate-100 outline-none focus:border-emerald-500 focus:bg-white dark:focus:bg-[#0D111A] transition resize-y leading-relaxed"
                  />

                  <div className="flex items-center justify-between text-[11px] text-gray-400 dark:text-slate-500">
                    <span>
                      💡 Tip de WhatsApp: Usa <code className="bg-gray-100 dark:bg-slate-800 px-1 py-0.5 rounded text-gray-700 dark:text-slate-300">*texto*</code> para resaltar en <strong>negrita</strong>.
                    </span>
                    <span>{config.plantillas[tipoPlantilla].length} caracteres</span>
                  </div>
                </div>
              </div>

              {/* Columna Derecha: Vista Previa Realista de WhatsApp (5 cols) */}
              <div className="lg:col-span-5 space-y-4">
                <div className="sticky top-20 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                      <Smartphone className="h-4 w-4 text-emerald-600" />
                      Vista Previa en WhatsApp (En Vivo):
                    </span>

                    <button
                      type="button"
                      onClick={() => handleCopiarVistaPrevia(textoVistaPrevia)}
                      className="flex items-center gap-1 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-[#111726] px-2.5 py-1 text-[11px] font-semibold text-gray-700 dark:text-slate-300 hover:bg-gray-50 transition active:scale-95"
                    >
                      {copiado ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-600" />
                          <span className="text-emerald-600">¡Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3 text-gray-500" />
                          <span>Copiar texto</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Teléfono / Chat WhatsApp Simulado */}
                  <div className="rounded-3xl border border-gray-300 dark:border-slate-800 bg-[#EFEAE2] dark:bg-[#0B141A] shadow-lg overflow-hidden">
                    {/* Barra superior de WhatsApp */}
                    <div className="bg-[#075E54] dark:bg-[#1F2C34] text-white px-4 py-3 flex items-center justify-between shadow-xs">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-700 text-white font-bold text-xs">
                          C5
                        </div>
                        <div>
                          <p className="text-xs font-bold leading-tight">{config.pagoMovil.nombre_cantina}</p>
                          <p className="text-[10px] text-emerald-200/90 leading-tight">en línea</p>
                        </div>
                      </div>
                      <span className="text-[10px] bg-emerald-800/80 px-2 py-0.5 rounded-full text-emerald-100">
                        Chat Oficial
                      </span>
                    </div>

                    {/* Contenedor del Mensaje */}
                    <div className="p-3.5 max-h-[520px] overflow-y-auto space-y-2">
                      {/* Burbuja Verde WhatsApp */}
                      <div className="ml-auto max-w-[92%] rounded-2xl rounded-tr-none bg-[#E7FFDB] dark:bg-[#005C4B] p-3 text-[11.5px] text-gray-900 dark:text-slate-100 shadow-xs relative">
                        <div className="whitespace-pre-wrap leading-relaxed break-words font-sans">
                          {formatearTextoWhatsApp(textoVistaPrevia)}
                        </div>

                        {/* Hora y checks de lectura */}
                        <div className="mt-1 flex items-center justify-end gap-1 text-[9px] text-gray-500 dark:text-emerald-200/70">
                          <span>12:00 PM</span>
                          <CheckCheck className="h-3.5 w-3.5 text-blue-500 dark:text-cyan-400 stroke-[2.5]" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-gray-500 dark:text-slate-400 text-center">
                    Los valores de ejemplo como el representante y montos son reemplazados en tiempo real al enviar.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PESTAÑA 2: DATOS DE PAGO MÓVIL & CANTINA */}
        {tabActiva === 'pagomovil' && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-gray-200/90 dark:border-slate-800 bg-white dark:bg-[#0D111A] p-5 shadow-2xs space-y-5">
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-indigo-600" />
                  Datos Oficiales de Pago Móvil y Negocio
                </h2>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                  Esta información se sustituye automáticamente en las plantillas de WhatsApp donde incluyas las etiquetas <code className="bg-gray-100 dark:bg-slate-800 px-1 py-0.5 rounded font-mono text-indigo-600 dark:text-indigo-400">{'{banco}'}</code>, <code className="bg-gray-100 dark:bg-slate-800 px-1 py-0.5 rounded font-mono text-indigo-600 dark:text-indigo-400">{'{cedula}'}</code>, <code className="bg-gray-100 dark:bg-slate-800 px-1 py-0.5 rounded font-mono text-indigo-600 dark:text-indigo-400">{'{telefono_pagomovil}'}</code> y <code className="bg-gray-100 dark:bg-slate-800 px-1 py-0.5 rounded font-mono text-indigo-600 dark:text-indigo-400">{'{telefono_reporte}'}</code>.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Nombre de la Cantina */}
                <div>
                  <label className="text-xs font-bold text-gray-700 dark:text-slate-300 block mb-1">
                    Nombre de la Cantina / Negocio:
                  </label>
                  <input
                    type="text"
                    value={config.pagoMovil.nombre_cantina}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        pagoMovil: { ...prev.pagoMovil, nombre_cantina: e.target.value },
                      }))
                    }
                    placeholder="Ej: Club 5 Cantina Escolar"
                    className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-gray-50/50 dark:bg-[#111726] px-3.5 py-2.5 text-xs font-medium text-gray-900 dark:text-slate-100 outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-[#0D111A]"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">Etiqueta: {'{nombre_cantina}'}</p>
                </div>

                {/* Banco Receptor */}
                <div>
                  <label className="text-xs font-bold text-gray-700 dark:text-slate-300 block mb-1">
                    Banco Receptor de Pago Móvil:
                  </label>
                  <input
                    type="text"
                    value={config.pagoMovil.banco}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        pagoMovil: { ...prev.pagoMovil, banco: e.target.value },
                      }))
                    }
                    placeholder="Ej: BNC (Banco Nacional de Crédito - 0191)"
                    className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-gray-50/50 dark:bg-[#111726] px-3.5 py-2.5 text-xs font-medium text-gray-900 dark:text-slate-100 outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-[#0D111A]"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">Etiqueta: {'{banco}'}</p>
                </div>

                {/* Cédula o RIF */}
                <div>
                  <label className="text-xs font-bold text-gray-700 dark:text-slate-300 block mb-1">
                    Cédula / RIF del Titular:
                  </label>
                  <input
                    type="text"
                    value={config.pagoMovil.cedula}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        pagoMovil: { ...prev.pagoMovil, cedula: e.target.value },
                      }))
                    }
                    placeholder="Ej: 14953511 o V-14953511"
                    className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-gray-50/50 dark:bg-[#111726] px-3.5 py-2.5 text-xs font-medium text-gray-900 dark:text-slate-100 outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-[#0D111A]"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">Etiqueta: {'{cedula}'}</p>
                </div>

                {/* Teléfono de Pago Móvil */}
                <div>
                  <label className="text-xs font-bold text-gray-700 dark:text-slate-300 block mb-1">
                    Teléfono Pago Móvil:
                  </label>
                  <input
                    type="text"
                    value={config.pagoMovil.telefono_pagomovil}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        pagoMovil: { ...prev.pagoMovil, telefono_pagomovil: e.target.value },
                      }))
                    }
                    placeholder="Ej: 04125404830"
                    className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-gray-50/50 dark:bg-[#111726] px-3.5 py-2.5 text-xs font-medium text-gray-900 dark:text-slate-100 outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-[#0D111A]"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">Etiqueta: {'{telefono_pagomovil}'}</p>
                </div>

                {/* Teléfono de Recepción de Captures */}
                <div>
                  <label className="text-xs font-bold text-gray-700 dark:text-slate-300 block mb-1">
                    WhatsApp para Reporte de Comprobantes:
                  </label>
                  <input
                    type="text"
                    value={config.pagoMovil.telefono_reporte}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        pagoMovil: { ...prev.pagoMovil, telefono_reporte: e.target.value },
                      }))
                    }
                    placeholder="Ej: 04123588848"
                    className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-gray-50/50 dark:bg-[#111726] px-3.5 py-2.5 text-xs font-medium text-gray-900 dark:text-slate-100 outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-[#0D111A]"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">Etiqueta: {'{telefono_reporte}'}</p>
                </div>

                {/* Nota de Pago en Efectivo */}
                <div>
                  <label className="text-xs font-bold text-gray-700 dark:text-slate-300 block mb-1">
                    Instrucción para Pago en Efectivo:
                  </label>
                  <input
                    type="text"
                    value={config.pagoMovil.nota_efectivo}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        pagoMovil: { ...prev.pagoMovil, nota_efectivo: e.target.value },
                      }))
                    }
                    placeholder="Ej: Directamente en caja de cantina ($ o Bs.)"
                    className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-gray-50/50 dark:bg-[#111726] px-3.5 py-2.5 text-xs font-medium text-gray-900 dark:text-slate-100 outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-[#0D111A]"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">Etiqueta: {'{nota_efectivo}'}</p>
                </div>
              </div>

              {/* Botón Guardar en la misma sección */}
              <div className="pt-3 border-t border-gray-100 dark:border-slate-800 flex justify-end">
                <button
                  type="button"
                  onClick={handleGuardar}
                  className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 transition active:scale-95"
                >
                  <Save className="h-4 w-4" />
                  <span>Guardar Datos Bancarios</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PESTAÑA 3: AJUSTES Y RESPALDO */}
        {tabActiva === 'sistema' && (
          <div className="space-y-6">
            {/* Opciones de Operación */}
            <div className="rounded-2xl border border-gray-200/90 dark:border-slate-800 bg-white dark:bg-[#0D111A] p-5 shadow-2xs space-y-4">
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Sliders className="h-5 w-5 text-purple-600" />
                  Preferencias del Sistema & Operación
                </h2>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                  Ajustes para simplificar la gestión cotidiana en el Punto de Venta.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                {/* Moneda Principal Preferida */}
                <div className="flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50">
                  <div>
                    <span className="text-xs font-bold text-gray-900 dark:text-white block">
                      Moneda Principal en Pantalla
                    </span>
                    <span className="text-[11px] text-gray-500 dark:text-slate-400">
                      Determina si el monto grande destacado en la caja se muestra en USD o en Bolívares.
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-gray-200 dark:bg-slate-800 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() =>
                        setConfig((prev) => ({
                          ...prev,
                          ajustes: { ...prev.ajustes, moneda_principal: 'USD' },
                        }))
                      }
                      className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                        config.ajustes.moneda_principal === 'USD'
                          ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-2xs'
                          : 'text-gray-600 dark:text-slate-400'
                      }`}
                    >
                      $ USD
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setConfig((prev) => ({
                          ...prev,
                          ajustes: { ...prev.ajustes, moneda_principal: 'BS' },
                        }))
                      }
                      className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                        config.ajustes.moneda_principal === 'BS'
                          ? 'bg-white dark:bg-slate-700 text-amber-700 dark:text-amber-300 shadow-2xs'
                          : 'text-gray-600 dark:text-slate-400'
                      }`}
                    >
                      Bs. Bolívares
                    </button>
                  </div>
                </div>

                {/* Confirmación al anular */}
                <div className="flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50">
                  <div>
                    <span className="text-xs font-bold text-gray-900 dark:text-white block">
                      Confirmación de Seguridad en Anulaciones
                    </span>
                    <span className="text-[11px] text-gray-500 dark:text-slate-400">
                      Solicitar confirmación antes de anular un pedido o consumo en el historial.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.ajustes.confirmar_anulaciones}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        ajustes: { ...prev.ajustes, confirmar_anulaciones: e.target.checked },
                      }))
                    }
                    className="h-4 w-4 rounded text-purple-600 focus:ring-purple-500"
                  />
                </div>
              </div>
            </div>

            {/* Respaldo y Restauración de Configuración */}
            <div className="rounded-2xl border border-gray-200/90 dark:border-slate-800 bg-white dark:bg-[#0D111A] p-5 shadow-2xs space-y-4">
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Download className="h-5 w-5 text-emerald-600" />
                  Copia de Seguridad y Restauración
                </h2>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                  Exporta tus plantillas y datos para tener una copia de respaldo o trasladarla a otra computadora.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleExportarConfig}
                  className="flex items-center gap-2 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-[#111726] px-4 py-2.5 text-xs font-bold text-gray-700 dark:text-slate-200 hover:bg-gray-50 transition active:scale-95 shadow-2xs"
                >
                  <Download className="h-4 w-4 text-emerald-600" />
                  <span>Exportar Configuración (.json)</span>
                </button>

                <label className="flex items-center gap-2 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-[#111726] px-4 py-2.5 text-xs font-bold text-gray-700 dark:text-slate-200 hover:bg-gray-50 transition active:scale-95 shadow-2xs cursor-pointer">
                  <Upload className="h-4 w-4 text-indigo-600" />
                  <span>Restaurar desde Archivo</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleImportarConfig}
                    className="hidden"
                  />
                </label>

                <button
                  type="button"
                  onClick={handleRestablecerTodo}
                  className="flex items-center gap-2 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/60 dark:bg-rose-950/20 px-4 py-2.5 text-xs font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-100 transition active:scale-95"
                >
                  <RotateCcw className="h-4 w-4 text-rose-600" />
                  <span>Restablecer Todo a Fábrica</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
