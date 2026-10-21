import type { GuidePair } from './types';

export const writeACase: GuidePair = {
  es: {
    slug: 'write-a-case',
    navLabel: 'Escribir un caso',
    title: 'Cómo escribir un caso de prueba',
    description:
      'Qué contiene un caso de prueba en Qably, qué lo hace bueno, cómo elegir su prioridad y cómo llegan los casos que propone Aeris.',
    sections: [
      {
        id: 'write-a-case',
        navLabel: 'Escribir un caso',
        title: 'Cómo escribir un caso de prueba',
        blocks: [
          {
            type: 'paragraph',
            text: 'Un caso de prueba describe **un comportamiento** de su producto: qué debe cumplirse antes, qué hacer y qué debe ocurrir. El código de la prueba decide si ese comportamiento sigue funcionando; el caso explica para qué sirve la prueba, de modo que una persona que no la escribió pueda entender un fallo.',
          },
          { type: 'subheading', text: 'Qué contiene un caso' },
          {
            type: 'paragraph',
            text: 'Estos campos se completan al agregar o editar un caso en una suite. Aeris propone todos menos el estado.',
          },
          {
            type: 'table',
            headers: ['Campo', 'Qué escribir'],
            rows: [
              ['Título', 'El comportamiento, con un verbo en presente y la condición esperada: "rechaza un token vencido".'],
              ['Objetivo', 'Qué verifica el caso, en una frase.'],
              ['Precondiciones', 'Lo que ya debe ser cierto antes del primer paso: la cuenta, los datos, la configuración.'],
              ['Pasos', 'Las acciones en orden, una por línea.'],
              ['Resultado esperado', 'Lo que muestra el usuario o el sistema cuando los pasos tienen éxito.'],
              ['Prioridad', 'Crítico, Alto, Medio o Bajo.'],
              ['Estado', 'Activo, Borrador o Deprecado.'],
            ],
          },
          {
            type: 'paragraph',
            text: 'Un caso es **manual** o **automatizado**. Una persona ejecuta el caso manual y registra su resultado en una ejecución manual. El caso automatizado está vinculado a una prueba de su repositorio y sus resultados provienen de los reportes que envía su CI. Qably considera un caso completamente documentado cuando tiene título, objetivo, pasos y resultado esperado; las precondiciones son opcionales.',
          },
          { type: 'subheading', text: 'Qué hace bueno a un caso' },
          {
            type: 'paragraph',
            text: 'Cinco hábitos separan un caso útil de uno que solo existe:',
          },
          {
            type: 'list',
            items: [
              '**Un comportamiento por caso.** Si el título necesita una "y", divídalo en dos. Es la misma regla de [nombrar las pruebas](/docs/naming-tests).',
              '**Independiente.** El caso prepara sus propios datos y no depende de que otro se haya ejecutado antes.',
              '**Datos y precondiciones explícitos.** Escriba el tipo de cuenta, el monto o la fecha. "Un usuario válido" obliga al lector a adivinar.',
              '**Un resultado verificable.** Indique qué aparece, cambia o se devuelve: "el total muestra 90.00", no "funciona".',
              '**Un título con verbo en presente.** "Rechaza un token vencido", "aplica un código de descuento". En una prueba automatizada, el título parte del nombre de la prueba, que además forma parte de la [identidad del caso](/docs/api-ingest-junit).',
            ],
          },
          { type: 'subheading', text: 'Un caso débil y uno bueno' },
          {
            type: 'paragraph',
            text: 'Ambos casos cubren la misma funcionalidad. El débil solo puede ejecutarlo su autor.',
          },
          {
            type: 'table',
            headers: ['Campo', 'Caso débil', 'Caso bueno'],
            rows: [
              ['Título', 'Login funciona', 'Inicia sesión con credenciales válidas y abre el panel'],
              ['Objetivo', 'Probar el login', 'Verificar que un usuario registrado llega al panel al ingresar su correo y su contraseña correctos'],
              ['Precondiciones', 'Existe un usuario', 'La cuenta `ana@example.com` existe y está activa'],
              ['Pasos', 'Iniciar sesión', 'Abrir la página de acceso; ingresar el correo y la contraseña correcta; seleccionar Iniciar sesión'],
              ['Resultado esperado', 'Funciona', 'Se abre el panel y muestra el nombre de la cuenta'],
            ],
          },
          {
            type: 'paragraph',
            text: 'La versión buena nombra sus datos, enumera pasos que cualquiera puede repetir y tiene un resultado que puede fallar de forma visible.',
          },
          { type: 'subheading', text: 'Cómo elegir la prioridad' },
          {
            type: 'paragraph',
            text: 'La prioridad indica al equipo qué mirar primero cuando fallan varios casos. Estos niveles son una práctica general de QA, así que ajústelos a su producto:',
          },
          {
            type: 'list',
            items: [
              '**Crítico:** el producto queda inutilizable o hay dinero, datos o accesos en riesgo. Por ejemplo, iniciar sesión, pagar, guardar un pedido.',
              '**Alto:** falla una funcionalidad principal, pero existe una alternativa.',
              '**Medio:** una funcionalidad secundaria o un camino poco frecuente.',
              '**Bajo:** detalles cosméticos y combinaciones poco probables.',
            ],
          },
          {
            type: 'paragraph',
            text: 'Una prueba rápida: si este caso fallara el día de un lanzamiento, ¿detendría usted el lanzamiento? Si la respuesta es sí, es Crítico o Alto. Si todo es Crítico, nada destaca.',
          },
          { type: 'subheading', text: 'Cómo llegan los casos a Qably' },
          {
            type: 'paragraph',
            text: 'Un caso llega a Qably de tres maneras:',
          },
          {
            type: 'list',
            ordered: true,
            items: [
              '**Escrito a mano.** Agregue un caso a una suite y complete los campos anteriores. Es un caso manual.',
              '**Reportado por su CI.** La primera vez que un reporte incluye una prueba que Qably no conocía, crea un caso en estado Borrador, con el título tomado del nombre de la prueba y sin pasos. La suite lo muestra como Sin documentar hasta que se documente.',
              '**Propuesto por Aeris.** Cuando un push modifica un archivo de prueba, Aeris, el asistente de IA de Qably, lo lee en el repositorio conectado y propone casos documentados. Las propuestas esperan en la **Bandeja de revisión** y nada pasa a ser oficial hasta que una persona lo aprueba.',
            ],
          },
          {
            type: 'paragraph',
            text: 'Tras un push, Aeris solo lee los archivos que coinciden con los **patrones de archivos de prueba** del proyecto. Por defecto son `*.spec.ts` y `*.test.ts`; edítelos en la vista Repositorio si sus pruebas se llaman de otra forma.',
          },
          {
            type: 'paragraph',
            text: 'La Bandeja de revisión muestra cada propuesta con el código fuente del que salió. Si la propuesta coincide con un caso existente, aprobarla publica una nueva versión de ese caso en lugar de crear un segundo caso. Una propuesta sin pasos no puede publicarse, y Rechazar descarta la que no desee.',
          },
          {
            type: 'paragraph',
            text: 'Para un caso automatizado que ya existe, **Documentar este caso** pide a Aeris que proponga su documentación, y la propuesta llega a la misma bandeja. Cuando una persona cambia el título, los pasos o el resultado esperado de un caso, Aeris lo deja intacto al documentar una suite.',
          },
          {
            type: 'callout',
            tone: 'warning',
            text: 'Revise una propuesta contra el requisito, no solo contra el código de la prueba. Aeris describe lo que hace una prueba; si la prueba es incorrecta, una propuesta aprobada publica ese error como caso oficial.',
          },
          {
            type: 'paragraph',
            text: 'Cuando ya tenga casos, [qué tipos de errores buscar](/docs/what-to-test) ayuda a encontrar los que faltan, y [las señales de un caso](/docs/case-health) indican cuáles necesitan trabajo.',
          },
        ],
      },
    ],
  },
  en: {
    slug: 'write-a-case',
    navLabel: 'Writing a case',
    title: 'How to write a test case',
    description:
      'What a test case holds in Qably, what makes it good, how to choose its priority and how the cases proposed by Aeris arrive.',
    sections: [
      {
        id: 'write-a-case',
        navLabel: 'Writing a case',
        title: 'How to write a test case',
        blocks: [
          {
            type: 'paragraph',
            text: 'A test case describes **one behavior** of your product: what must be true before, what to do and what must happen. The test code decides whether that behavior still works; the case explains what the test is for, so a person who did not write it can understand a failure.',
          },
          { type: 'subheading', text: 'What a case contains' },
          {
            type: 'paragraph',
            text: 'You fill in these fields when you add or edit a case in a suite. Aeris proposes all of them except the state.',
          },
          {
            type: 'table',
            headers: ['Field', 'What to write'],
            rows: [
              ['Title', 'The behavior, as an active verb plus the expected condition: "rejects an expired token".'],
              ['Objective', 'What the case verifies, in one sentence.'],
              ['Preconditions', 'What must already be true before the first step: the account, the data, the configuration.'],
              ['Steps', 'The actions in order, one per line.'],
              ['Expected result', 'What the user or the system shows when the steps succeed.'],
              ['Priority', 'Critical, High, Medium or Low.'],
              ['State', 'Active, Draft or Deprecated.'],
            ],
          },
          {
            type: 'paragraph',
            text: 'A case is **manual** or **automated**. A person runs a manual case and records its result in a manual run. An automated case is linked to a test in your repository, and its results come from the reports your CI sends. Qably treats a case as completely documented when it has a title, an objective, steps and an expected result; preconditions are optional.',
          },
          { type: 'subheading', text: 'What makes a good case' },
          {
            type: 'paragraph',
            text: 'Five habits separate a case that helps from one that only exists:',
          },
          {
            type: 'list',
            items: [
              '**One behavior per case.** If the title needs an "and", split it in two. It is the same rule as in [naming tests](/docs/naming-tests).',
              '**Independent.** The case sets up its own data and does not depend on another case having run first.',
              '**Explicit data and preconditions.** Write the account type, the amount or the date. "A valid user" leaves the reader guessing.',
              '**A verifiable result.** State what appears, changes or is returned: "the total shows 90.00", not "it works".',
              '**A title with an active verb.** "Rejects an expired token", "applies a discount code". For an automated test, the title starts from the test name, which is also part of the [identity of the case](/docs/api-ingest-junit).',
            ],
          },
          { type: 'subheading', text: 'A weak case and a good one' },
          {
            type: 'paragraph',
            text: 'Both cases below cover the same feature. The weak one can only be run by its author.',
          },
          {
            type: 'table',
            headers: ['Field', 'Weak case', 'Good case'],
            rows: [
              ['Title', 'Login works', 'Signs in with valid credentials and opens the dashboard'],
              ['Objective', 'Test login', 'Verify that a registered user reaches the dashboard after entering the right email and password'],
              ['Preconditions', 'A user exists', 'The account `ana@example.com` exists and is active'],
              ['Steps', 'Log in', 'Open the sign-in page; enter the email and the correct password; select Sign in'],
              ['Expected result', 'It works', 'The dashboard opens and shows the name of the account'],
            ],
          },
          {
            type: 'paragraph',
            text: 'The good version names its data, lists steps anyone can repeat and has a result that can fail visibly.',
          },
          { type: 'subheading', text: 'Choosing a priority' },
          {
            type: 'paragraph',
            text: 'Priority tells the team what to look at first when several cases fail. These levels are general QA practice, so adjust them to your product:',
          },
          {
            type: 'list',
            items: [
              '**Critical:** the product becomes unusable, or money, data or access is at risk. For example, signing in, paying, saving an order.',
              '**High:** a main feature breaks, but a workaround exists.',
              '**Medium:** a secondary feature or a rare path.',
              '**Low:** cosmetic details and unlikely combinations.',
            ],
          },
          {
            type: 'paragraph',
            text: 'A quick test: if this case failed on the day of a release, would you stop the release? If so, it is Critical or High. If everything is Critical, nothing stands out.',
          },
          { type: 'subheading', text: 'How cases get into Qably' },
          {
            type: 'paragraph',
            text: 'A case reaches Qably in one of three ways:',
          },
          {
            type: 'list',
            ordered: true,
            items: [
              '**Written by hand.** Add a case to a suite and fill in the fields above. It is a manual case.',
              '**Reported by your CI.** The first time a report includes a test Qably did not know, it creates a case in the Draft state, with a title taken from the test name and no steps. The suite shows it as Undocumented until it is documented.',
              '**Proposed by Aeris.** When a push changes a test file, Aeris, the AI assistant of Qably, reads it in the connected repository and proposes documented cases. Proposals wait in the **Review Inbox**, and nothing becomes official until a person approves it.',
            ],
          },
          {
            type: 'paragraph',
            text: 'After a push, Aeris only reads the files that match the **test file patterns** of the project. The defaults are `*.spec.ts` and `*.test.ts`; edit them in the Repository view if your tests are named differently.',
          },
          {
            type: 'paragraph',
            text: 'The Review Inbox shows each proposal with the source code it came from. If a proposal matches an existing case, approving it publishes a new version of that case instead of creating a second case. A proposal without steps cannot be published, and Reject discards one you do not want.',
          },
          {
            type: 'paragraph',
            text: 'For an automated case that already exists, **Document this case** asks Aeris to propose its documentation, and the proposal arrives in the same inbox. Once a person changes the title, the steps or the expected result of a case, Aeris leaves it untouched when it documents a suite.',
          },
          {
            type: 'callout',
            tone: 'warning',
            text: 'Review a proposal against the requirement, not only against the test code. Aeris describes what a test does; if the test is wrong, an approved proposal publishes that mistake as an official case.',
          },
          {
            type: 'paragraph',
            text: 'Once you have cases, [what kinds of errors to look for](/docs/what-to-test) helps you find the ones that are missing, and [the signals of a case](/docs/case-health) show which ones need work.',
          },
        ],
      },
    ],
  },
};
