import type { GuidePair } from './types';

export const whatToTest: GuidePair = {
  es: {
    slug: 'what-to-test',
    navLabel: 'Qué errores buscar',
    title: 'Qué tipos de errores buscar',
    description:
      'Una lista de los tipos de errores que conviene probar, con títulos de caso y prioridades de ejemplo, y cómo decidir qué automatizar primero.',
    sections: [
      {
        id: 'what-to-test',
        navLabel: 'Qué errores buscar',
        title: 'Qué tipos de errores buscar',
        blocks: [
          {
            type: 'paragraph',
            text: 'Esta página es una guía general de QA, no una función de Qably. Úsela como lista de verificación al planificar una funcionalidad: recorra los tipos de errores siguientes y escriba un caso para cada uno que pueda perjudicar a sus usuarios.',
          },
          { type: 'subheading', text: 'Los tipos de errores que conviene buscar' },
          {
            type: 'table',
            headers: ['Tipo', 'Qué buscar', 'Título de caso de ejemplo', 'Prioridad sugerida'],
            rows: [
              ['Funcional (camino feliz)', 'El flujo principal hace lo que promete la funcionalidad, con datos corrientes.', 'Crea un pedido a partir de un carrito válido', 'Crítico'],
              ['Validación de entradas y límites', 'Campos obligatorios, longitudes mínimas y máximas, el valor justo dentro y justo fuera de cada límite.', 'Rechaza una contraseña de 7 caracteres', 'Alto'],
              ['Caminos negativos y manejo de errores', 'Contraseña incorrecta, sesión vencida, un servicio que no responde.', 'Muestra un error cuando el servicio de pagos agota el tiempo de espera', 'Alto'],
              ['Estado y flujo', 'Pasos fuera de orden, la misma acción dos veces, volver atrás, reintentar.', 'Cobra un pedido una sola vez cuando se selecciona Pagar dos veces', 'Crítico'],
              ['Permisos y roles', 'Cada rol ve y hace solo lo que le corresponde; una cuenta no puede acceder a los datos de otra.', 'Niega el acceso a la factura de otra cuenta', 'Crítico'],
              ['Integraciones y contratos', 'Respuestas de API, webhooks y llamadas a terceros: códigos de estado, campos, formatos y comportamiento cuando el otro lado es lento o responde mal.', 'Devuelve 404 para un pedido que no existe', 'Alto'],
              ['Datos', 'Valores vacíos, valores muy grandes, caracteres especiales, fechas, zonas horarias y redondeos.', 'Guarda un nombre con tilde y apóstrofo', 'Medio'],
              ['Regresiones', 'Cada error que corrige. Agregue un caso para que no vuelva sin que nadie lo note.', 'Aplica un cupón una sola vez por pedido', 'La del error original'],
            ],
          },
          {
            type: 'paragraph',
            text: 'Las prioridades son un punto de partida. El mismo tipo de error cambia de prioridad según la funcionalidad: validar el monto de un pago es Crítico; validar la biografía de un perfil es Bajo.',
          },
          {
            type: 'paragraph',
            text: 'Redacte cada título como en [nombrar las pruebas](/docs/naming-tests): un verbo en presente más la condición esperada, y un comportamiento por caso. "Rechaza una contraseña de 7 caracteres" puede fallar por una sola razón; "valida la contraseña" puede fallar por diez.',
          },
          { type: 'subheading', text: 'De una funcionalidad a una lista de casos' },
          {
            type: 'paragraph',
            text: 'Restablecer una contraseña por correo parece algo pequeño, pero recorrer la tabla produce al menos seis casos:',
          },
          {
            type: 'list',
            ordered: true,
            items: [
              '**Funcional:** envía un enlace de restablecimiento a un correo registrado.',
              '**Validación:** rechaza un correo con formato inválido.',
              '**Camino negativo:** muestra un error cuando el servicio de correo no está disponible.',
              '**Estado:** rechaza un enlace de restablecimiento que ya se usó.',
              '**Tiempo:** rechaza un enlace de restablecimiento vencido.',
              '**Datos:** acepta un correo escrito con mayúsculas.',
            ],
          },
          {
            type: 'paragraph',
            text: 'No todos los tipos aplican a todas las funcionalidades. Omita los que no apliquen y escriba el resto.',
          },
          { type: 'subheading', text: 'Qué automatizar primero' },
          {
            type: 'paragraph',
            text: 'No se puede automatizar todo a la vez. Empiece donde un fallo cuesta más o donde ocurre con más frecuencia:',
          },
          {
            type: 'list',
            items: [
              '**Flujos críticos.** Iniciar sesión, pagar y las acciones que mueven dinero o datos.',
              '**Zonas que ya fallaron.** Un módulo que tuvo tres errores el trimestre pasado probablemente tendrá un cuarto.',
              '**Comportamiento estable.** Una prueba sobre una pantalla que se rediseña cada semana cuesta más mantener de lo que ahorra.',
            ],
          },
          {
            type: 'paragraph',
            text: 'Deje como casos manuales las revisiones exploratorias, las revisiones visuales puntuales y las funcionalidades que todavía se rediseñan. Qably mantiene los casos manuales y automatizados en la misma suite, de modo que ambos quedan documentados en un solo lugar.',
          },
          { type: 'subheading', text: 'Qué hace Qably después' },
          {
            type: 'paragraph',
            text: 'Su CI envía cada reporte a Qably, así que cada caso automatizado acumula un historial de resultados. [Las señales de un caso](/docs/case-health) indican cuáles necesitan atención. Cuando un caso que antes pasaba empieza a fallar, [leer una regresión](/docs/regressions) explica cómo Qably compara dos ejecuciones y qué commits son candidatos. Para redactar los casos y elegir su prioridad, consulte [cómo escribir un caso de prueba](/docs/write-a-case).',
          },
        ],
      },
    ],
  },
  en: {
    slug: 'what-to-test',
    navLabel: 'What to test',
    title: 'What kinds of errors to look for',
    description:
      'A checklist of the kinds of errors worth testing, with example case titles and priorities, and how to decide what to automate first.',
    sections: [
      {
        id: 'what-to-test',
        navLabel: 'What to test',
        title: 'What kinds of errors to look for',
        blocks: [
          {
            type: 'paragraph',
            text: 'This page is general QA advice, not a feature of Qably. Use it as a checklist when you plan a feature: walk through the kinds of errors below and write a case for each one that could hurt your users.',
          },
          { type: 'subheading', text: 'The kinds of errors worth looking for' },
          {
            type: 'table',
            headers: ['Type', 'What to look for', 'Example case title', 'Suggested priority'],
            rows: [
              ['Functional (happy path)', 'The main flow does what the feature promises, with ordinary data.', 'Creates an order from a valid cart', 'Critical'],
              ['Input validation and boundaries', 'Required fields, minimum and maximum lengths, the value just inside and just outside each limit.', 'Rejects a password of 7 characters', 'High'],
              ['Negative paths and error handling', 'Wrong password, expired session, a service that does not answer.', 'Shows an error when the payment service times out', 'High'],
              ['State and workflow', 'Steps out of order, the same action twice, going back, retrying.', 'Charges an order once when Pay is selected twice', 'Critical'],
              ['Permissions and roles', 'Each role sees and does only what it should; one account cannot reach the data of another.', 'Denies access to the invoice of another account', 'Critical'],
              ['Integrations and contracts', 'API responses, webhooks and third-party calls: status codes, fields, formats and behavior when the other side is slow or wrong.', 'Returns 404 for an order that does not exist', 'High'],
              ['Data', 'Empty values, very large values, special characters, dates, time zones and rounding.', 'Saves a name with an accent and an apostrophe', 'Medium'],
              ['Regressions', 'Every bug you fix. Add a case for it so it cannot come back unnoticed.', 'Applies a coupon only once per order', 'That of the original bug'],
            ],
          },
          {
            type: 'paragraph',
            text: 'The priorities are a starting point. The same kind of error changes priority with the feature: validating the amount of a payment is Critical; validating the biography of a profile is Low.',
          },
          {
            type: 'paragraph',
            text: 'Write each title as in [naming tests](/docs/naming-tests): an active verb plus the expected condition, one behavior per case. "Rejects a password of 7 characters" can fail for one reason; "validates the password" can fail for ten.',
          },
          { type: 'subheading', text: 'From one feature to a list of cases' },
          {
            type: 'paragraph',
            text: 'Resetting a password by email looks small, but walking through the table gives at least six cases:',
          },
          {
            type: 'list',
            ordered: true,
            items: [
              '**Functional:** sends a reset link to a registered email address.',
              '**Validation:** rejects a malformed email address.',
              '**Negative path:** shows an error when the email service is unavailable.',
              '**State:** rejects a reset link that was already used.',
              '**Time:** rejects a reset link after it expires.',
              '**Data:** accepts an email address written in capital letters.',
            ],
          },
          {
            type: 'paragraph',
            text: 'Not every kind applies to every feature. Skip the ones that do not apply and write the rest.',
          },
          { type: 'subheading', text: 'What to automate first' },
          {
            type: 'paragraph',
            text: 'You cannot automate everything at once. Start where a failure costs the most or happens most often:',
          },
          {
            type: 'list',
            items: [
              '**Critical flows.** Signing in, paying, and the actions that move money or data.',
              '**Areas that already broke.** A module that had three bugs last quarter is likely to have a fourth.',
              '**Stable behavior.** A test on a screen that is redesigned every week costs more to maintain than it saves.',
            ],
          },
          {
            type: 'paragraph',
            text: 'Leave exploratory checks, one-off visual reviews and features that are still being redesigned as manual cases. Qably keeps manual and automated cases in the same suite, so both stay documented in one place.',
          },
          { type: 'subheading', text: 'What Qably does afterwards' },
          {
            type: 'paragraph',
            text: 'Your CI sends each report to Qably, so every automated case builds a result history. [The signals of a case](/docs/case-health) show which ones need attention. When a case that used to pass starts failing, [reading a regression](/docs/regressions) explains how Qably compares two runs and which commits are candidates. To write the cases and choose their priority, see [how to write a test case](/docs/write-a-case).',
          },
        ],
      },
    ],
  },
};
