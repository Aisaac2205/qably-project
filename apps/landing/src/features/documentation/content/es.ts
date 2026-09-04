import type { DocContent } from './types';

export const es: DocContent = {
  pageTitle: 'Documentación — Qably',
  pageDescription:
    'Cómo conectar un repositorio, emitir una API key y reportar resultados de CI a Qably — basado en el contrato real de la API.',
  breadcrumbLabel: 'Guía de integración',
  tocLabel: 'Tabla de contenidos',
  heroTitle: 'Documentación',
  heroSubtitle:
    'Todo lo que aparece aquí coincide con la API tal como existe hoy. Si una capacidad no está documentada, todavía no existe.',
  navGroups: [
    { label: 'Primeros pasos', sectionIds: ['getting-started'] },
    {
      label: 'Guía de configuración',
      sectionIds: [
        'step-1-create-project',
        'step-2-connect-repository',
        'step-3-api-key',
        'step-4-report-ci',
        'step-5-verify',
      ],
    },
    { label: 'Otros lenguajes', sectionIds: ['other-languages'] },
    {
      label: 'Referencia',
      sectionIds: [
        'reference-runs-ingest',
        'reference-runs-ingest-junit',
        'reference-webhook',
        'reference-api-keys',
        'reference-env-vars',
      ],
    },
    { label: 'Plataforma', sectionIds: ['platform-overview'] },
    { label: 'Ayuda', sectionIds: ['faq'] },
  ],
  sections: [
    {
      id: 'getting-started',
      navLabel: 'Primeros pasos',
      title: 'Primeros pasos',
      blocks: [
        {
          type: 'paragraph',
          text: 'Qably es una plataforma de gestión de calidad para equipos de ingeniería. No ejecuta las pruebas; un agente externo lo hace (el pipeline de CI, hoy) y envía los resultados a Qably por HTTP. Qably los recibe, los almacena y ofrece un solo lugar para ver qué se ejecutó, qué cambió en el repositorio y qué todavía falta cubrir.',
        },
        { type: 'subheading', text: 'Dos pipelines independientes' },
        {
          type: 'paragraph',
          text: 'Qably se alimenta de dos pipelines que nunca dependen entre sí. Conectar uno no conecta el otro, y esta es la causa más común de confusión cuando una pantalla aparece vacía.',
        },
        {
          type: 'table',
          headers: ['Pipeline', 'Endpoint', 'Credencial', 'Llena'],
          rows: [
            [
              'Resultados de pruebas',
              'POST /runs/ingest',
              'API key del proyecto, en Authorization: Bearer',
              'Suites, casos y runs — lo que muestra el dashboard',
            ],
            [
              'Cambios de código',
              'POST /webhooks/scm/:provider',
              'Firma HMAC, sin API key',
              'Cambios de código, lotes de ingesta y evidencia — lo que muestra la página Repository de un proyecto',
            ],
          ],
        },
        {
          type: 'callout',
          tone: 'warning',
          text: 'Un reporter de CI que envía resultados de pruebas nunca llena la página Repository, y conectar un repositorio nunca reporta un solo resultado de prueba. Cuando una pantalla se ve vacía, conviene revisar cuál pipeline debería llenarla; las preguntas frecuentes al final de esta guía cubren las causas más comunes.',
        },
        { type: 'subheading', text: 'Requisitos previos' },
        {
          type: 'list',
          items: [
            'Una cuenta de Qably con al menos una organización',
            'Un repositorio en GitHub o Bitbucket — los únicos dos proveedores que Qably soporta hoy',
            'Un pipeline de CI que pueda ejecutar un script o enviar una petición HTTP después de ejecutar las pruebas',
          ],
        },
      ],
    },
    {
      id: 'step-1-create-project',
      navLabel: '1. Crear el proyecto',
      title: '1. Crear el proyecto',
      blocks: [
        {
          type: 'paragraph',
          text: 'Cada proyecto pertenece a una sola organización y se crea desde Proyectos > Nuevo proyecto en la app web.',
        },
        {
          type: 'list',
          items: [
            'Nombre — obligatorio, hasta 80 caracteres',
            'Descripción — opcional, hasta 500 caracteres',
            'Tecnologías — opcional; se completan automáticamente al conectar un repositorio, en el siguiente paso',
          ],
        },
        {
          type: 'paragraph',
          text: 'No es necesario contar con un repositorio para crear un proyecto. Conectar uno, emitir una API key y reportar desde CI son tres pasos independientes, y pueden realizarse en cualquier orden.',
        },
        {
          type: 'callout',
          tone: 'info',
          text: 'El proyecto nuevo se abre con suites vacías, sin runs y con un aviso de repositorio no conectado. Es el comportamiento esperado, ya que todavía no se reportó nada.',
        },
      ],
    },
    {
      id: 'step-2-connect-repository',
      navLabel: '2. Conectar el repositorio',
      title: '2. Conectar el repositorio vía el webhook del SCM',
      blocks: [
        {
          type: 'paragraph',
          text: 'Este paso conecta el segundo pipeline. Los cambios de código llegan a Qably a través del webhook del proveedor del repositorio, y no tiene relación con la API key del paso 3.',
        },
        { type: 'subheading', text: 'Selección del repositorio' },
        {
          type: 'list',
          ordered: true,
          items: [
            'El inicio de sesión con GitHub (o Bitbucket) se hace una vez, si aún no se hizo. Qably lee ese token de OAuth para listar los repositorios accesibles, tanto en la cuenta personal como en las organizaciones asociadas.',
            'En la configuración de Integraciones del proyecto, se selecciona un repositorio de la lista combinada de repositorios ya conectados y disponibles, ordenada por el push más reciente.',
            'Elegir un repositorio sin conectar crea una conexión dentro de la organización y genera un secreto de webhook para ella. Elegir uno ya conectado reutiliza su conexión existente.',
          ],
        },
        { type: 'subheading', text: 'Registro del webhook en el proveedor' },
        {
          type: 'paragraph',
          text: 'Qably nunca registra el webhook automáticamente; se agrega una vez, en la configuración del propio repositorio.',
        },
        {
          type: 'list',
          ordered: true,
          items: [
            'El secreto se obtiene llamando a POST /connections/:id/webhook-secret desde la configuración de la conexión. La respuesta contiene el secreto en texto plano exactamente una vez, al crearlo y de nuevo cada vez que se rota, por lo que conviene copiarlo de inmediato.',
            'En GitHub, el webhook se agrega desde Settings > Webhooks > Add webhook, dentro del repositorio.',
            'Payload URL: https://api.qably.dev/webhooks/scm/github',
            'Content type: application/json',
            'Secret: el valor del paso anterior',
            'Events: como mínimo push.',
            'También conviene incluir los eventos de pull request, para que Qably registre esa actividad.',
          ],
        },
        {
          type: 'callout',
          tone: 'info',
          text: 'Qably verifica cada entrega contra ese secreto con una firma HMAC-SHA256 (encabezado x-hub-signature-256, con el formato sha256=<hex>) antes de aceptarla. Una firma ausente o que no coincide se rechaza directamente, nunca se ignora en silencio.',
        },
        {
          type: 'paragraph',
          text: 'Las conexiones de Bitbucket funcionan igual, con el encabezado de firma propio de Bitbucket en lugar del de GitHub. GitHub y Bitbucket son los únicos dos proveedores soportados hoy.',
        },
        {
          type: 'callout',
          tone: 'info',
          text: 'Una entrega exitosa aparece en el historial del webhook, del lado del proveedor. En la página Repository del proyecto, el último lote de ingesta, sus cambios de código y su evidencia aparecen después del siguiente push o pull request.',
        },
      ],
    },
    {
      id: 'step-3-api-key',
      navLabel: '3. Emitir una API key',
      title: '3. Emitir una API key',
      blocks: [
        {
          type: 'paragraph',
          text: 'Este paso conecta el primer pipeline, una identidad que el CI puede usar para reportar resultados de pruebas, sin sesión y sin un usuario detrás.',
        },
        {
          type: 'list',
          ordered: true,
          items: [
            'Desde la configuración de API Keys del proyecto, se crea una key con un nombre descriptivo como "CI/CD Pipeline"; se requiere el rol owner o admin en la organización.',
            'El token tiene la forma qbly_<lookupId>_<secret> y se muestra una sola vez, en la respuesta de creación, por lo que conviene copiarlo de inmediato. Qably guarda solo su hash SHA-256 y no puede volver a mostrarlo.',
            'Se guarda como secreto en el proveedor de CI, por ejemplo un secret de repositorio en GitHub Actions llamado QABLY_API_KEY, y nunca debe subirse al repositorio.',
          ],
        },
        {
          type: 'paragraph',
          text: 'Una key está limitada a exactamente un proyecto y solo puede escribir resultados de ejecución para ese proyecto. No puede leer otros proyectos, listar suites ni tocar la organización; el proyecto siempre se deriva de la key, nunca de algo que envíe la petición.',
        },
        {
          type: 'paragraph',
          text: 'Revocar una key, desde la misma pantalla, la marca como revocada sin borrarla, así los runs anteriores siguen atribuidos a ella. Un proyecto puede tener varias keys activas a la vez, lo que permite rotar una sin dejar nunca a CI sin acceso.',
        },
      ],
    },
    {
      id: 'step-4-report-ci',
      navLabel: '4. Reportar resultados desde CI',
      title: '4. Reportar resultados desde CI',
      blocks: [
        {
          type: 'paragraph',
          text: 'El reporter es un script de referencia pequeño que se agrega al repositorio de la integración, por ejemplo como scripts/qably-report.mjs. Lee un archivo JUnit XML, convierte cada <testsuite> en una llamada a POST /runs/ingest y solo necesita una variable de entorno: QABLY_API_KEY.',
        },
        {
          type: 'callout',
          tone: 'info',
          text: 'Sin QABLY_API_KEY configurada, el script registra un mensaje y termina con código 0; nunca hace fallar el build por una integración ausente o todavía no configurada.',
        },
        { type: 'subheading', text: 'Proyectos con Jest' },
        {
          type: 'paragraph',
          text: 'jest-junit se agrega como dependencia de desarrollo y se configura para escribir en un archivo de reporte mediante dos variables de entorno, antes de invocar el reporter.',
        },
        {
          type: 'code',
          language: 'yaml',
          code: `- name: Unit tests
  env:
    JEST_JUNIT_OUTPUT_DIR: ./reports
    JEST_JUNIT_OUTPUT_NAME: junit.xml
  run: npx jest --ci --reporters=default --reporters=jest-junit

- name: Report results to Qably
  if: always()
  env:
    QABLY_API_KEY: \${{ secrets.QABLY_API_KEY }}
  run: node scripts/qably-report.mjs ./reports/junit.xml`,
        },
        { type: 'subheading', text: 'Proyectos con Vitest' },
        {
          type: 'paragraph',
          text: 'Vitest escribe JUnit XML de forma nativa — sin dependencia extra.',
        },
        {
          type: 'code',
          language: 'yaml',
          code: `- name: Unit tests
  run: npx vitest run --reporter=default --reporter=junit --outputFile=./reports/junit.xml

- name: Report results to Qably
  if: always()
  env:
    QABLY_API_KEY: \${{ secrets.QABLY_API_KEY }}
  run: node scripts/qably-report.mjs ./reports/junit.xml`,
        },
        {
          type: 'callout',
          tone: 'warning',
          text: 'Ambos pasos usan if: always(). Reportar a Qably nunca condiciona el build. Una caída de Qably o una key revocada es un problema de Qably, no del pull request. El paso de pruebas en sí, no el de reporte, es el que debería hacer fallar el CI.',
        },
        {
          type: 'paragraph',
          text: 'Un archivo JUnit con varios elementos <testsuite> — uno por archivo de prueba, que es como los escriben tanto jest-junit como Vitest — se convierte en una llamada a POST /runs/ingest por suite, enviadas en secuencia. El primer reporte para un nombre de suite crea esa suite en Qably automáticamente; nunca hace falta precrearla.',
        },
      ],
    },
    {
      id: 'step-5-verify',
      navLabel: '5. Verificar que llegaron los datos',
      title: '5. Verificar que llegaron los datos',
      blocks: [
        {
          type: 'paragraph',
          text: 'Cada pipeline se confirma por separado, ya que uno puede funcionar mientras el otro todavía necesita atención.',
        },
        {
          type: 'list',
          items: [
            'El estado de los resultados de pruebas se confirma abriendo el proyecto y localizando el run que el CI acaba de reportar. Ese estado se deriva de los casos enviados: cualquier caso fallido hace fallar el run, de lo contrario cualquier caso pendiente o en ejecución lo mantiene en ejecución, y solo pasa una vez que al menos un caso terminó en pass o skip (un run donde todos los casos están blocked igual cuenta como fail, porque nada en él se verificó realmente).',
            'Los cambios de código solo se verifican una vez completado el paso 2. La página Repository del proyecto debe mostrar que el último lote de ingesta refleja el push o pull request más reciente.',
          ],
        },
        {
          type: 'callout',
          tone: 'info',
          text: 'Si falta información, las preguntas frecuentes más abajo cubren las dos causas más comunes: un webhook que nunca se registró y un reporter de CI corriendo sin QABLY_API_KEY configurada.',
        },
      ],
    },
    {
      id: 'other-languages',
      navLabel: 'JUnit XML desde cualquier lenguaje',
      title: 'Reportar JUnit XML desde cualquier lenguaje',
      blocks: [
        {
          type: 'paragraph',
          text: 'Al reporter no le importa qué lenguaje generó el reporte. Lee cualquier archivo con una estructura <testsuite>/<testcase> y deriva el estado de cada caso a partir de un elemento hijo <failure>, <error> o <skipped>, de la misma forma para cada ecosistema de abajo. El JUnit XML se genera con las herramientas propias de cada framework, y luego se apunta el reporter al archivo resultante.',
        },
        { type: 'subheading', text: 'JavaScript y TypeScript' },
        {
          type: 'paragraph',
          text: 'Jest y Vitest ya están cubiertos en el paso anterior; aquí no cambia nada.',
        },
        { type: 'subheading', text: 'Playwright' },
        {
          type: 'paragraph',
          text: 'El reporter de JUnit incorporado escribe a la salida estándar a menos que se indique un archivo, ya sea mediante una variable de entorno o en el archivo de configuración.',
        },
        {
          type: 'code',
          language: 'shell',
          code: `# Variable de entorno
PLAYWRIGHT_JUNIT_OUTPUT_NAME=results.xml npx playwright test --reporter=junit

# Reportarlo
node scripts/qably-report.mjs results.xml`,
        },
        {
          type: 'paragraph',
          text: "También puede configurarse una vez en playwright.config.ts: reporter: [['junit', { outputFile: 'results.xml' }]].",
        },
        { type: 'subheading', text: 'pytest' },
        {
          type: 'code',
          language: 'shell',
          code: `pytest --junitxml=report.xml
node scripts/qably-report.mjs report.xml`,
        },
        { type: 'subheading', text: 'Java — Maven (Surefire)' },
        {
          type: 'paragraph',
          text: 'mvn test escribe un reporte por clase de prueba sin ninguna bandera extra; el plugin Surefire lo hace por defecto.',
        },
        {
          type: 'code',
          language: 'shell',
          code: `mvn test
# escribe target/surefire-reports/TEST-*.xml, un archivo por clase de prueba

for f in target/surefire-reports/TEST-*.xml; do
  node scripts/qably-report.mjs "$f"
done`,
        },
        { type: 'subheading', text: 'Java — Gradle' },
        {
          type: 'code',
          language: 'shell',
          code: `./gradlew test
# escribe build/test-results/test/TEST-*.xml, un archivo por clase de prueba

for f in build/test-results/test/TEST-*.xml; do
  node scripts/qably-report.mjs "$f"
done`,
        },
        { type: 'subheading', text: 'PHPUnit' },
        {
          type: 'paragraph',
          text: 'PHPUnit 9 y anteriores aceptan una bandera directa por línea de comandos. PHPUnit 10 en adelante la eliminó, por lo que el archivo de salida se configura en phpunit.xml.',
        },
        {
          type: 'code',
          language: 'shell',
          code: `# PHPUnit 9 y anteriores
phpunit --log-junit junit.xml
node scripts/qably-report.mjs junit.xml`,
        },
        {
          type: 'code',
          language: 'yaml',
          code: `<!-- PHPUnit 10+, en phpunit.xml -->
<logging>
    <junit outputFile="junit.xml"/>
</logging>`,
        },
        {
          type: 'code',
          language: 'shell',
          code: `# PHPUnit 10+
phpunit -c phpunit.xml
node scripts/qably-report.mjs junit.xml`,
        },
        { type: 'subheading', text: '.NET' },
        {
          type: 'paragraph',
          text: 'El paquete NuGet JunitXml.TestLogger se agrega como dependencia, y el logger se pasa por línea de comandos.',
        },
        {
          type: 'code',
          language: 'shell',
          code: `dotnet test --logger:"junit;LogFilePath=test-result.xml"
node scripts/qably-report.mjs test-result.xml`,
        },
        { type: 'subheading', text: 'Go' },
        {
          type: 'callout',
          tone: 'warning',
          text: 'La invocación de abajo no fue verificada contra documentación actual — no había documentación indexada para go-junit-report al momento de escribir esta guía. Conviene revisar el propio repositorio de la herramienta antes de confiar en ella.',
        },
        {
          type: 'code',
          language: 'shell',
          code: `go test -v ./... 2>&1 | go-junit-report > report.xml
node scripts/qably-report.mjs report.xml`,
        },
        {
          type: 'callout',
          tone: 'warning',
          text: 'En Qably, la identidad de un caso dentro de una suite se determina por el atributo exacto name de <testcase>; el atributo classname se ignora. Por eso, dos pruebas llamadas test_login en clases distintas se resuelven como el mismo caso de prueba.',
        },
        {
          type: 'callout',
          tone: 'warning',
          text: 'pytest emite un único <testsuite name="pytest"> para toda la corrida, mientras que Jest y Vitest emiten uno por archivo de prueba. Todo lo que corre en pytest cae por defecto en una sola suite de Qably. Para una granularidad más parecida a la de Jest y Vitest, puede configurarse junit_suite_name en la configuración de pytest, o dividir la corrida; es una diferencia de valores por defecto, no un error.',
        },
      ],
    },
    {
      id: 'reference-runs-ingest',
      navLabel: 'POST /runs/ingest',
      title: 'Referencia: POST /runs/ingest',
      blocks: [
        {
          type: 'paragraph',
          text: 'Reporta los resultados de ejecución de una suite. Se autentica con Authorization: Bearer <API key del proyecto>. El proyecto y la organización vienen de la key; nada en el cuerpo puede sobrescribirlos.',
        },
        {
          type: 'code',
          language: 'typescript',
          code: `{
  "externalId": "gh-run-482913",
  "source": "github_actions",
  "suiteId": "suite_123",
  "name": "Checkout regression - main",
  "startedAt": "2026-09-01T10:00:00Z",
  "finishedAt": "2026-09-01T10:04:12Z",
  "commitSha": "a1b2c3d",
  "commitMessage": "fix: checkout rounding",
  "commitAuthor": "Ada Lovelace",
  "cases": [
    { "name": "Adds an item to the cart", "status": "pass" },
    {
      "name": "Applies a discount code",
      "steps": ["open cart", "apply code SAVE10"],
      "expectedResult": "total is reduced by 10%",
      "status": "fail"
    }
  ]
}`,
        },
        {
          type: 'table',
          headers: ['Campo', 'Obligatorio', 'Notas'],
          rows: [
            ['externalId', 'sí', 'String no vacío. Es la clave de idempotencia — repetir el mismo valor actualiza en lugar de duplicar.'],
            ['source', 'no', '"api" (por defecto) o "github_actions".'],
            ['suiteId / suiteName', 'exactamente uno', 'Un suiteId que no resuelve devuelve 404. Un suiteName que no resuelve se adopta: la suite se crea al instante.'],
            ['name', 'sí', 'El nombre visible del run, hasta 200 caracteres.'],
            ['startedAt / finishedAt', 'no', 'Fechas ISO 8601 con offset explícito.'],
            ['commitSha / commitMessage / commitAuthor', 'no', 'Metadata libre del commit, hasta 64 / 2000 / 200 caracteres.'],
            ['cases', 'sí', 'Al menos un elemento.'],
          ],
        },
        {
          type: 'table',
          headers: ['Campo del caso', 'Obligatorio', 'Notas'],
          rows: [
            ['name', 'sí', 'Hasta 120 caracteres.'],
            ['suiteName', 'no', 'Por defecto usa el nombre de la suite resuelta; permite que un caso conserve una etiqueta distinta (por ejemplo un nombre de proyecto de Playwright) como evidencia de auditoría.'],
            ['steps', 'no', 'Arreglo de strings, hasta 50 elementos de 500 caracteres cada uno. Por defecto es un arreglo vacío. JUnit XML no tiene un campo equivalente, así que los reportes convertidos desde JUnit siempre llegan con un arreglo vacío — un reporter propio que postee JSON directamente sí puede completarlo.'],
            ['expectedResult', 'no', 'Hasta 1000 caracteres. Por defecto es un string vacío, por la misma razón que steps.'],
            ['status', 'sí', 'Uno de pending, running, pass, fail, skip, blocked.'],
            ['recordedAt', 'no', 'Fecha ISO 8601 con offset explícito.'],
          ],
        },
        {
          type: 'paragraph',
          text: 'Run.status se deriva del lado del servidor, nunca se confía en lo que envía el cliente: cualquier caso fallido hace fallar el run; de lo contrario cualquier caso pendiente o en ejecución lo mantiene en ejecución; de lo contrario pasa una vez que al menos un caso está en pass o skip — un run donde todos los casos están blocked igual cuenta como fail, porque nada en él se verificó realmente.',
        },
        {
          type: 'paragraph',
          text: 'Repetir el mismo (proyecto, source, externalId) actualiza en lugar de duplicar: el conjunto de casos se reemplaza por completo, y la metadata opcional solo se sobrescribe cuando la repetición realmente la incluye. Responde 200 OK tanto en el primer reporte como en cada repetición.',
        },
      ],
    },
    {
      id: 'reference-runs-ingest-junit',
      navLabel: 'POST /runs/ingest/junit',
      title: 'Referencia: POST /runs/ingest/junit',
      blocks: [
        {
          type: 'paragraph',
          text: 'En lugar de ejecutar un script de reporte propio, el reporte JUnit XML puede enviarse sin procesar para que Qably lo analice del lado del servidor. Misma autenticación que POST /runs/ingest.',
        },
        {
          type: 'paragraph',
          text: 'El reporte va en el cuerpo de la petición como XML crudo, con Content-Type en application/xml o text/xml (límite de 10 MB). Todo lo demás viaja como parámetros de consulta, ya que no hay un cuerpo JSON para llevarlos.',
        },
        {
          type: 'table',
          headers: ['Parámetro de consulta', 'Obligatorio', 'Notas'],
          rows: [
            ['externalId', 'sí', 'La misma clave de idempotencia que POST /runs/ingest.'],
            ['source', 'no', '"api" (por defecto) o "github_actions".'],
            ['suiteId / suiteName', 'no', 'Las mismas reglas de resolución que POST /runs/ingest. Cuando no se envía ninguno, el nombre de la suite sale del propio atributo <testsuite name="..."> del reporte.'],
            ['name', 'no', 'Por defecto usa el nombre de suite del reporte cuando se omite.'],
            ['startedAt / finishedAt / commitSha / commitMessage / commitAuthor', 'no', 'Los mismos campos que POST /runs/ingest.'],
          ],
        },
        {
          type: 'code',
          language: 'shell',
          code: `curl --fail --silent \\
  --request POST \\
  "https://api.qably.dev/runs/ingest/junit?externalId=ci-42" \\
  --header "Authorization: Bearer $QABLY_API_KEY" \\
  --header "Content-Type: application/xml" \\
  --data-binary @junit.xml`,
        },
        {
          type: 'paragraph',
          text: 'El nombre de un caso siempre sale de <testcase name="...">; classname solo se lee como respaldo cuando name falta por completo, algo que un JUnit real casi nunca hace. Un reporte inválido o vacío responde 400, no 500.',
        },
      ],
    },
    {
      id: 'reference-webhook',
      navLabel: 'POST /webhooks/scm/:provider',
      title: 'Referencia: POST /webhooks/scm/:provider',
      blocks: [
        {
          type: 'paragraph',
          text: ':provider es github o bitbucket, sin distinguir mayúsculas. No hay API key en esta ruta — cada entrega se verifica contra el secreto HMAC de una conexión que coincida con el repositorio del evento.',
        },
        {
          type: 'table',
          headers: ['', 'GitHub', 'Bitbucket'],
          rows: [
            ['Encabezado de firma', 'x-hub-signature-256, con formato sha256=<hex>', 'x-hub-signature, con formato sha256=<hex>'],
            ['Encabezado de evento', 'x-github-event: push o pull_request', 'x-event-key: repo:push, pullrequest:created o pullrequest:updated'],
            ['Encabezado de id de entrega', 'x-github-delivery', 'x-request-uuid'],
            ['Acciones de pull request manejadas', 'opened, synchronize', 'created, updated'],
          ],
        },
        {
          type: 'table',
          headers: ['Respuesta', 'Significado'],
          rows: [
            ['202, { "status": "accepted" }', 'Firma verificada, evento guardado y encolado para procesarse'],
            ['202, { "status": "duplicate" }', 'El mismo (proveedor, id de entrega) ya se procesó — las repeticiones son idempotentes'],
            ['202, { "status": "ignored" }', 'Un proveedor reconocido y una firma válida, pero un tipo de evento que Qably no procesa'],
            ['404', 'Proveedor desconocido en la ruta'],
            ['401', 'La verificación de firma falló contra todas las conexiones de ese repositorio'],
            ['400', 'El cuerpo no es JSON válido'],
          ],
        },
        {
          type: 'paragraph',
          text: 'Límite de 60 peticiones cada 60 segundos por instancia. Los eventos aceptados se encolan y se procesan de forma asíncrona — la respuesta confirma la recepción, no que el procesamiento haya terminado.',
        },
      ],
    },
    {
      id: 'reference-api-keys',
      navLabel: 'API keys',
      title: 'Referencia: API keys',
      blocks: [
        {
          type: 'paragraph',
          text: 'Una key tiene la forma qbly_<lookupId>_<secret>: un prefijo fijo, un id de búsqueda público de 6 bytes usado para encontrar la fila, y un secreto de 32 bytes que es la única parte que prueba posesión. Qably guarda solo su hash SHA-256 y lo compara en tiempo constante — el token en texto plano nunca se puede recuperar después de crearlo.',
        },
        {
          type: 'table',
          headers: ['Acción', 'Endpoint', 'Rol requerido'],
          rows: [
            ['Listar keys', 'GET /projects/:projectId/api-keys', 'Cualquier miembro de la organización'],
            ['Crear una key', 'POST /projects/:projectId/api-keys, cuerpo { "name": string }', 'owner o admin'],
            ['Revocar una key', 'POST /projects/:projectId/api-keys/:id/revoke', 'owner o admin'],
          ],
        },
        {
          type: 'paragraph',
          text: 'Una key revocada nunca se borra, así que cada run anterior sigue atribuido a ella. Se utiliza en las peticiones como Authorization: Bearer qbly_<lookupId>_<secret>.',
        },
      ],
    },
    {
      id: 'reference-env-vars',
      navLabel: 'Variables de entorno',
      title: 'Referencia: variables de entorno',
      blocks: [
        {
          type: 'paragraph',
          text: 'Estas son las variables que se configuran en el CI de la integración, no la configuración de despliegue de Qably; esta guía está escrita para quienes integran y envían datos a un Qably alojado, no para quienes operan la plataforma en sí.',
        },
        {
          type: 'table',
          headers: ['Variable', 'Obligatoria', 'Notas'],
          rows: [
            ['QABLY_API_KEY', 'sí, para reportar algo', 'La lee el reporter. Si no está configurada, el script registra un mensaje y termina con código 0 sin enviar nada; nunca hace fallar el build.'],
            ['QABLY_API_BASE_URL', 'no', 'Por defecto usa https://api.qably.dev. Se configura para un despliegue propio o una corrida local contra http://localhost:3001.'],
          ],
        },
      ],
    },
    {
      id: 'platform-overview',
      navLabel: 'Visión general de la plataforma',
      title: 'Visión general de la plataforma',
      blocks: [
        {
          type: 'paragraph',
          text: 'El backend expone la API descrita en esta guía y está organizado por dominio de negocio, con almacenamiento persistente y colas de procesamiento en segundo plano para el trabajo asíncrono. El dashboard web es la interfaz donde el equipo revisa ese estado.',
        },
        { type: 'subheading', text: 'Áreas del backend' },
        {
          type: 'table',
          headers: ['Módulo', 'Responsabilidad'],
          rows: [
            ['auth', 'Sesiones e inicio de sesión con GitHub OAuth'],
            ['organizations', 'Membresía de organización y el scope de cada petición'],
            ['projects', 'Proyectos, límites de plan y su conexión con un repositorio'],
            ['connections', 'Conexiones de repositorio, secretos de webhook y detección de stack a partir de los manifiestos del repositorio'],
            ['ingestion', 'Verifica y normaliza los eventos entrantes del webhook del SCM, y los encola para procesarse'],
            ['runs', 'Los dos endpoints de /runs/ingest, el historial de runs y casos, y la derivación de estado'],
            ['suites', 'Suites de prueba y sus casos de prueba'],
            ['api-keys', 'Emitir, listar y revocar API keys de proyecto'],
            ['repository', 'Sirve los cambios de código, lotes de ingesta y evidencia que acumuló un proyecto'],
            ['dashboard', 'Las cifras agregadas que lee el dashboard web'],
            ['notifications', 'Publica eventos de run completado y run fallido para un proyecto'],
            ['mailer', 'Correo transaccional, por ejemplo restablecimiento de contraseña'],
          ],
        },
        {
          type: 'paragraph',
          text: 'El procesamiento es asíncrono: un evento aceptado se registra y se encola de inmediato, y la respuesta confirma la recepción, no que el evento ya se procesó por completo. Cada operación de dominio que puede fallar por una razón esperada (no encontrado, nombre ya usado, límite de plan alcanzado) devuelve un resultado tipado en lugar de lanzar una excepción, así el límite entre una regla de negocio esperada y un error real del servidor queda explícito.',
        },
        { type: 'subheading', text: 'Superficies del dashboard web' },
        {
          type: 'list',
          items: [
            'Dashboard — KPIs de tasa de aprobación de los últimos 7 días, una tabla de salud de proyectos, un calendario de trazabilidad y actividad reciente',
            'Proyectos — creación, el selector de tecnologías y la configuración propia de cada proyecto',
            'La pantalla de API Keys de un proyecto — crear, listar y revocar keys',
            'La página Repository de un proyecto — los cambios de código, lotes de ingesta y evidencia que alimenta el webhook del SCM',
          ],
        },
      ],
    },
    {
      id: 'faq',
      navLabel: 'Preguntas frecuentes',
      title: 'Preguntas frecuentes',
      blocks: [
        {
          type: 'faq',
          items: [
            {
              question: 'El CI recibe un 403 con una página de Cloudflare "Just a moment..."',
              answer: [
                {
                  type: 'paragraph',
                  text: 'La API está detrás de un desafío anti-bots, y las peticiones desde IPs de datacenter (que es lo que son la mayoría de los runners de CI) reciben el desafío en lugar de pasar directo. Esto necesita una regla de WAF que salte el desafío para el hostname de la API, cubriendo tanto /runs/ingest como /webhooks/scm/* — una regla que solo cubra una de esas rutas deja el otro pipeline roto.',
                },
              ],
            },
            {
              question: 'El CI está en verde pero no aparece nada en Qably',
              answer: [
                {
                  type: 'paragraph',
                  text: 'Es un comportamiento intencional: una falla al reportar se registra como advertencia y nunca hace fallar el build. Conviene revisar los logs del workflow en busca de una línea ::warning:: de qably-report, y confirmar que QABLY_API_KEY esté realmente configurada como secret en el job que ejecutó el paso de reporte.',
                },
              ],
            },
            {
              question: '404 — suite no encontrada',
              answer: [
                {
                  type: 'paragraph',
                  text: 'Un suiteId que no resuelve se trata como error del cliente a propósito: un id explícito es una afirmación de que algo ya existe, y el endpoint nunca crea una suite a partir de uno. En su lugar, se puede enviar suiteName — un nombre que no resuelve se adopta automáticamente, creando la suite al instante.',
                },
              ],
            },
            {
              question: 'Los casos llegan sin steps y sin expectedResult',
              answer: [
                {
                  type: 'paragraph',
                  text: 'Es esperable cuando el reporte vino de JUnit XML: el formato no tiene ninguno de los dos campos, así que tanto el reporter como POST /runs/ingest/junit envían un arreglo vacío y un string vacío para ellos. La API acepta ambos campos si un reporter propio postea JSON directamente a POST /runs/ingest con steps y expectedResult completos.',
                },
              ],
            },
            {
              question: 'La página Repository de un proyecto está vacía',
              answer: [
                {
                  type: 'paragraph',
                  text: 'El webhook del SCM nunca se configuró para ese proyecto; el paso 2 detalla cómo hacerlo. Reportar resultados de pruebas desde CI nunca llena la página Repository; solo el webhook lo hace.',
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};
