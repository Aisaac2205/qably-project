import { API_BASE_URL_TOKEN, type DocContent } from './types';

export const es: DocContent = {
  pageTitle: 'Documentación | Qably',
  pageDescription:
    'Guía para conectar repositorios, generar API keys y enviar resultados de pruebas de CI a Qably según el contrato de la API.',
  breadcrumbLabel: 'Guía de integración',
  tocLabel: 'Tabla de contenidos',
  heroTitle: 'Documentación',
  heroSubtitle:
    'Especificación técnica de la API pública de Qably. Describe los endpoints, esquemas de datos y flujos de integración disponibles.',
  copyCodeLabel: 'Copiar código',
  copiedLabel: '¡Copiado!',
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
    { label: 'Buenas prácticas', sectionIds: ['naming-tests'] },
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
    { label: 'Notificaciones', sectionIds: ['notifications-discord-slack'] },
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
          text: 'Qably centraliza la gestión de calidad para equipos de ingeniería. La plataforma no ejecuta pruebas directamente: los resultados se generan en pipelines externos de integración continua y se envían a Qably vía HTTP. El sistema almacena las ejecuciones y consolida el historial de cambios, suites y cobertura.',
        },
        { type: 'subheading', text: 'Dos flujos independientes' },
        {
          type: 'paragraph',
          text: 'Qably procesa dos flujos de datos desacoplados. Configurar uno no activa el otro, lo cual explica por qué ciertas vistas pueden aparecer vacías inicialmente.',
        },
        {
          type: 'table',
          headers: ['Pipeline', 'Endpoint', 'Credencial', 'Llena'],
          rows: [
            [
              'Resultados de pruebas',
              'POST /runs/ingest',
              'API key del proyecto (Authorization: Bearer)',
              'Suites, casos y ejecuciones en el panel principal',
            ],
            [
              'Cambios de código',
              'POST /webhooks/scm/:provider',
              'Firma HMAC (sin API key)',
              'Historial de commits, lotes de ingesta y trazabilidad en la vista Repository',
            ],
          ],
        },
        {
          type: 'callout',
          tone: 'warning',
          text: 'El envío de resultados de pruebas desde CI no alimenta la vista Repository, y conectar un repositorio no registra ejecuciones de prueba. Si una pantalla no muestra información, verifique cuál de los dos flujos debe suministrarla.',
        },
        { type: 'subheading', text: 'Requisitos previos' },
        {
          type: 'list',
          items: [
            'Una cuenta en Qably con al menos una organización activa.',
            'Un repositorio alojado en GitHub o Bitbucket (proveedores compatibles actualmente).',
            'Un pipeline de CI con capacidad de ejecutar pruebas y enviar peticiones HTTP al concluir.',
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
          text: 'Cada proyecto está vinculado a una organización. Para crearlo, diríjase a Proyectos > Nuevo proyecto en la consola web.',
        },
        {
          type: 'list',
          items: [
            'Nombre (obligatorio, hasta 80 caracteres)',
            'Descripción (opcional, hasta 500 caracteres)',
            'Tecnologías (opcional, se autocompletan al vincular el repositorio en el siguiente paso)',
          ],
        },
        {
          type: 'paragraph',
          text: 'No es indispensable contar con un repositorio vinculado para inicializar el proyecto. Conectar el repositorio, generar la API key y configurar el reporte en CI son pasos independientes que pueden realizarse en cualquier orden.',
        },
        {
          type: 'callout',
          tone: 'info',
          text: 'Los proyectos nuevos inician sin suites registradas, sin ejecuciones y con el indicador de repositorio desconectado hasta recibir la primera carga de datos.',
        },
      ],
    },
    {
      id: 'step-2-connect-repository',
      navLabel: '2. Conectar el repositorio',
      title: '2. Conectar el repositorio mediante el webhook del SCM',
      blocks: [
        {
          type: 'paragraph',
          text: 'Este paso habilita el flujo de cambios de código. Qably recibe las actualizaciones mediante webhooks enviados por el proveedor del repositorio, de forma independiente a la API key del paso 3.',
        },
        { type: 'subheading', text: 'Selección del repositorio' },
        {
          type: 'list',
          ordered: true,
          items: [
            'Inicie sesión con GitHub o Bitbucket si aún no lo ha hecho. Qably utiliza este token de OAuth para listar los repositorios accesibles en su cuenta personal y organizaciones asociadas.',
            'En la sección Integraciones del proyecto, seleccione el repositorio deseado de la lista disponible, ordenada por fecha de push reciente.',
            'Al seleccionar un repositorio no vinculado, se crea una conexión dentro de la organización y se genera su secreto de webhook. Seleccionar un repositorio previamente vinculado reutiliza la conexión existente.',
          ],
        },
        { type: 'subheading', text: 'Registro del webhook en el proveedor' },
        {
          type: 'paragraph',
          text: 'Qably no registra webhooks de forma automática en proveedores externos. Debe agregarse manualmente en la configuración del repositorio.',
        },
        {
          type: 'list',
          ordered: true,
          items: [
            'Obtenga el secreto ejecutando POST /connections/:id/webhook-secret desde la interfaz de la conexión. La respuesta entrega el valor en texto plano una sola vez (al crearlo o rotarlo), por lo que debe copiarse inmediatamente.',
            'En GitHub, acceda a Settings > Webhooks > Add webhook dentro del repositorio.',
            `Payload URL: ${API_BASE_URL_TOKEN}/webhooks/scm/github`,
            'Content type: application/json',
            'Secret: el valor obtenido en el paso anterior',
            'Events: seleccione push como mínimo. Se recomienda marcar también pull request para registrar la actividad completa del equipo.',
          ],
        },
        {
          type: 'callout',
          tone: 'info',
          text: 'Qably valida cada entrega entrante contra el secreto registrado mediante una firma HMAC-SHA256 (encabezado x-hub-signature-256 en formato sha256=<hex>). Las peticiones sin firma o con firmas inválidas se rechazan con código HTTP 401.',
        },
        {
          type: 'paragraph',
          text: 'Las conexiones de Bitbucket siguen el mismo principio, utilizando el encabezado de firma propio de Bitbucket. Actualmente, GitHub y Bitbucket son los dos proveedores compatibles.',
        },
        {
          type: 'callout',
          tone: 'info',
          text: 'Las entregas exitosas se reflejan de inmediato en el historial de webhooks del proveedor. En la vista Repository de Qably, el lote de ingesta y los cambios de código aparecerán tras el siguiente push o pull request.',
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
          text: 'Este paso habilita el flujo de resultados de pruebas, proporcionando una credencial de máquina para que el pipeline de CI reporte ejecuciones sin requerir una sesión de usuario.',
        },
        {
          type: 'list',
          ordered: true,
          items: [
            'En la pestaña API Keys del proyecto, cree una clave asignándole un nombre identificable como "CI/CD Pipeline". Esta acción requiere rol de owner o admin en la organización.',
            'El token generado sigue la estructura qbly_<lookupId>_<secret> y se muestra una única vez en la pantalla de confirmación. Qably almacena únicamente su hash SHA-256 y no puede recuperarlo posteriormente.',
            'Guarde el valor en su proveedor de CI. En GitHub Actions, vaya a Settings > Secrets and variables > Actions > Secrets y cree el secreto de repositorio QABLY_API_KEY. Si utiliza una URL personalizada, agregue la variable QABLY_API_BASE_URL en la pestaña Variables. Nunca incluya este token en el repositorio de código.',
          ],
        },
        {
          type: 'paragraph',
          text: 'Cada API key tiene alcance exclusivo sobre un proyecto y únicamente permite registrar ejecuciones. No tiene permisos de lectura sobre otros proyectos ni facultades administrativas sobre la organización. El proyecto destino se infiere directamente de la clave.',
        },
        {
          type: 'paragraph',
          text: 'Revocar una clave desactiva su uso de forma inmediata pero conserva los registros históricos asociados. Es posible mantener múltiples claves activas simultáneamente para facilitar la rotación sin interrumpir los pipelines de CI.',
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
          text: 'Para conectar Qably a su integración continua, configure su ejecutor de pruebas para emitir un reporte JUnit XML y agregue un paso para enviarlo a la API de Qably con su clave secreta.',
        },
        {
          type: 'paragraph',
          text: 'En Jest, instale jest-junit y defina JEST_JUNIT_ADD_FILE_ATTRIBUTE: "true" para que el XML incluya la ruta de archivo de cada caso de prueba, lo que permite a Qably vincular las pruebas con el código fuente. En Vitest, el reporte JUnit se genera de forma nativa indicando el reporter correspondiente.',
        },
        {
          type: 'codeGroup',
          label: 'Flujo en GitHub Actions',
          variants: [
            {
              language: 'yaml',
              label: 'Jest',
              code: `- name: Run Jest tests
  env:
    JEST_JUNIT_OUTPUT_DIR: ./reports
    JEST_JUNIT_OUTPUT_NAME: junit.xml
    JEST_JUNIT_ADD_FILE_ATTRIBUTE: 'true'
  run: npx jest --ci --reporters=default --reporters=jest-junit

- name: Report results to Qably
  if: always()
  env:
    QABLY_API_KEY: \${{ secrets.QABLY_API_KEY }}
  run: |
    curl --fail --silent --request POST \\
      "${API_BASE_URL_TOKEN}/runs/ingest/junit?externalId=gha-\${{ github.run_id }}-\${{ github.job }}&source=github_actions" \\
      --header "Authorization: Bearer $QABLY_API_KEY" \\
      --header "Content-Type: application/xml" \\
      --data-binary @./reports/junit.xml || true`,
            },
            {
              language: 'yaml',
              label: 'Vitest',
              code: `- name: Run Vitest tests
  run: npx vitest run --reporter=default --reporter=junit --outputFile=./reports/junit.xml

- name: Report results to Qably
  if: always()
  env:
    QABLY_API_KEY: \${{ secrets.QABLY_API_KEY }}
  run: |
    curl --fail --silent --request POST \\
      "${API_BASE_URL_TOKEN}/runs/ingest/junit?externalId=gha-\${{ github.run_id }}-\${{ github.job }}&source=github_actions" \\
      --header "Authorization: Bearer $QABLY_API_KEY" \\
      --header "Content-Type: application/xml" \\
      --data-binary @./reports/junit.xml || true`,
            },
          ],
        },
        {
          type: 'callout',
          tone: 'warning',
          text: 'La directiva if: always() es indispensable: garantiza que los resultados se envíen incluso si hay pruebas fallidas. El reporte hacia Qably nunca detiene el pipeline: el fallo del build debe depender del resultado de las pruebas, no del envío del reporte.',
        },
        {
          type: 'paragraph',
          text: 'El endpoint POST /runs/ingest/junit recibe el archivo XML directo y procesa todo en el servidor. Si el reporte contiene suites o casos no registrados previamente, Qably los crea de forma automática en ese proyecto.',
        },
        {
          type: 'callout',
          tone: 'info',
          text: 'Idempotencia ante reintentos: al utilizar externalId con el identificador de ejecución (como github.run_id), si se reintenta un job en GitHub Actions con Re-run failed jobs, Qably actualiza la ejecución existente en lugar de registrar duplicados.',
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
          text: 'Cada flujo se valida de forma independiente, dado que uno puede estar recibiendo datos mientras el otro requiere ajustes de configuración.',
        },
        {
          type: 'list',
          items: [
            'Resultados de pruebas: abra el proyecto y verifique la ejecución recién enviada por CI. El estado general del run se deriva de sus casos: cualquier prueba fallida marca el run como fallido; casos en ejecución o pendientes lo mantienen en progreso; y se considera exitoso cuando al menos un caso pasa o se omite sin fallas acompañantes.',
            'Cambios de código: requiere haber completado el paso 2. La vista Repository del proyecto debe reflejar el lote de ingesta correspondiente al push o pull request más reciente.',
          ],
        },
        {
          type: 'callout',
          tone: 'info',
          text: 'Si los datos no se visualizan en la interfaz, consulte la sección de preguntas frecuentes para diagnosticar webhooks no registrados o variables de entorno omitidas en CI.',
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
          text: 'El backend de Qably procesa cualquier archivo con estructura estándar <testsuite>/<testcase>, extrayendo el resultado de cada prueba a partir de los elementos <failure>, <error> o <skipped>. Genere el reporte XML utilizando las herramientas nativas de su lenguaje y envíe el archivo resultante en su pipeline de CI.',
        },
        { type: 'subheading', text: 'JavaScript y TypeScript' },
        {
          type: 'paragraph',
          text: 'Jest y Vitest se detallaron en el paso anterior y mantienen la misma configuración.',
        },
        {
          type: 'codeGroup',
          label: 'Reportar JUnit XML desde cualquier lenguaje',
          variants: [
            {
              language: 'shell',
              label: 'Playwright',
              code: 'PLAYWRIGHT_JUNIT_OUTPUT_NAME=results.xml npx playwright test --reporter=junit',
            },
            {
              language: 'shell',
              label: 'pytest',
              code: 'pytest --junitxml=report.xml',
            },
            {
              language: 'shell',
              label: 'Java (Maven Surefire)',
              code: `mvn test
# genera target/surefire-reports/TEST-*.xml`,
            },
            {
              language: 'shell',
              label: 'Java (Gradle)',
              code: `./gradlew test
# genera build/test-results/test/TEST-*.xml`,
            },
            {
              language: 'shell',
              label: 'PHPUnit 9 y anteriores',
              code: 'phpunit --log-junit junit.xml',
            },
            {
              language: 'shell',
              label: 'PHPUnit 10+',
              code: 'phpunit -c phpunit.xml',
            },
            {
              language: 'shell',
              label: '.NET',
              code: 'dotnet test --logger:"junit;LogFilePath=test-result.xml"',
            },
            {
              language: 'shell',
              label: 'Go',
              code: 'go test -v ./... 2>&1 | go-junit-report > report.xml',
            },
          ],
        },
        {
          type: 'paragraph',
          text: 'El reporter de JUnit incorporado en Playwright escribe a la salida estándar a menos que se indique un archivo, ya sea mediante una variable de entorno o en el archivo de configuración.',
        },
        {
          type: 'paragraph',
          text: "También puede configurarse una vez en playwright.config.ts: reporter: [['junit', { outputFile: 'results.xml' }]].",
        },
        {
          type: 'paragraph',
          text: 'mvn test escribe un reporte por clase de prueba sin ninguna bandera extra; el plugin Surefire lo hace por defecto.',
        },
        {
          type: 'paragraph',
          text: 'PHPUnit 9 y anteriores aceptan una bandera directa por línea de comandos. PHPUnit 10 en adelante la eliminó, por lo que el archivo de salida se configura en phpunit.xml.',
        },
        {
          type: 'paragraph',
          text: 'El paquete NuGet JunitXml.TestLogger se agrega como dependencia, y el logger se pasa por línea de comandos.',
        },
        {
          type: 'callout',
          tone: 'warning',
          text: 'El comando sugerido para go-junit-report debe validarse con la documentación oficial de la herramienta antes de integrarlo en entornos productivos.',
        },
        {
          type: 'callout',
          tone: 'warning',
          text: 'En Qably, la identidad de un caso dentro de una suite se define exclusivamente por el atributo name del elemento <testcase>; el atributo classname se descarta. Por lo tanto, dos pruebas denominadas test_login en clases distintas se consolidarán bajo el mismo caso.',
        },
        {
          type: 'callout',
          tone: 'warning',
          text: 'pytest genera de forma predeterminada un único elemento <testsuite name="pytest"> para toda la sesión de pruebas, a diferencia de Jest o Vitest, que generan uno por archivo. En consecuencia, todas las pruebas de pytest se agrupan en una única suite en Qably. Para obtener una granularidad por archivo, defina junit_suite_name en la configuración de pytest o divida la ejecución en varios comandos.',
        },
      ],
    },
    {
      id: 'naming-tests',
      navLabel: 'Nombrar las pruebas',
      title: 'Cómo nombrar tus pruebas para Qably',
      blocks: [
        {
          type: 'paragraph',
          text: 'Qably deriva los nombres de las pruebas y suites a partir de los identificadores emitidos por el ejecutor de pruebas y la estructura de archivos del repositorio. Los títulos definidos en el código se reflejan directamente en la plataforma, convirtiendo los nombres de las pruebas en documentación técnica accesible para todo el equipo.',
        },
        {
          type: 'paragraph',
          text: 'Las siguientes pautas de diseño ayudan a estructurar suites descriptivas y legibles:',
        },
        {
          type: 'list',
          ordered: true,
          items: [
            'Agrupe por funcionalidad de negocio en lugar de estructuras técnicas o clases internas. Los bloques descriptivos deben reflejar la acción del usuario (por ejemplo, "Carrito de compras" en lugar de "CartServiceImpl").',
            'Redacte cada prueba combinando un verbo en presente y la condición esperada: "rechaza un token vacío", "acepta un token de hasta 500 caracteres".',
            'Limite cada prueba a un comportamiento específico. Nombres que requieren conectores como "y" suelen indicar casos compuestos que conviene independizar.',
            'Nombre el archivo según el módulo o funcionalidad que valida, ya que este nombre define el título de la suite en Qably.',
          ],
        },
        {
          type: 'subheading',
          text: 'Normalización automática de nombres',
        },
        {
          type: 'paragraph',
          text: 'Durante la ingesta, Qably formatea identificadores técnicos en texto legible separando palabras en camelCase o snake_case y omitiendo prefijos comunes como "test", "spec", "prueba" o "caso". De este modo, un identificador como testTokenNull se registra en la plataforma como "Token null".',
        },
        {
          type: 'paragraph',
          text: 'Si el nombre en el código ya está formulado como una oración (por ejemplo, "debe rechazar un token vacío"), Qably conserva la redacción intacta capitalizando únicamente la primera letra sin alterar el verbo ni recortar términos.',
        },
        {
          type: 'callout',
          tone: 'info',
          text: 'Qably no traduce el contenido de las pruebas. El identificador técnico actúa como clave de enlace entre el código fuente y el historial de ejecuciones. Si su equipo escribe pruebas en inglés pero opera la plataforma en español, las descripciones traducidas deben gestionarse en la documentación del caso, no en su identificador.',
        },
        {
          type: 'subheading',
          text: 'Un ejemplo antes y después',
        },
        {
          type: 'table',
          headers: ['En lugar de', 'Escribe'],
          rows: [
            ['test_login_1', 'inicia sesión con credenciales válidas'],
            ['testTokenNull', 'rechaza un token vacío'],
            ['should return 400 when body is invalid and user is anonymous', 'rechaza una solicitud con cuerpo inválido'],
            ['UserServiceTest.java', 'registro-de-usuarios'],
          ],
        },
        {
          type: 'paragraph',
          text: 'No es necesario renombrar pruebas existentes para comenzar a utilizar Qably. La plataforma importa los identificadores actuales y respeta cualquier ajuste manual posterior: si un miembro del equipo edita el título de un caso desde la consola, las importaciones subsecuentes preservan el valor modificado.',
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
          text: 'Registra los resultados de ejecución de una suite de pruebas. Requiere autenticación mediante el encabezado Authorization: Bearer <API key del proyecto>. El proyecto y la organización se determinan a partir de la clave.',
        },
        {
          type: 'codeGroup',
          label: 'POST /runs/ingest',
          variants: [
            {
              language: 'shell',
              label: 'cURL',
              code: `curl --fail --silent \\
  --request POST \\
  "${API_BASE_URL_TOKEN}/runs/ingest" \\
  --header "Authorization: Bearer $QABLY_API_KEY" \\
  --header "Content-Type: application/json" \\
  --data '{
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
  }'`,
            },
            {
              language: 'typescript',
              label: 'Node',
              code: `const response = await fetch('${API_BASE_URL_TOKEN}/runs/ingest', {
  method: 'POST',
  headers: {
    Authorization: \`Bearer \${process.env.QABLY_API_KEY}\`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    externalId: 'gh-run-482913',
    source: 'github_actions',
    suiteId: 'suite_123',
    name: 'Checkout regression - main',
    startedAt: '2026-09-01T10:00:00Z',
    finishedAt: '2026-09-01T10:04:12Z',
    commitSha: 'a1b2c3d',
    commitMessage: 'fix: checkout rounding',
    commitAuthor: 'Ada Lovelace',
    cases: [
      { name: 'Adds an item to the cart', status: 'pass' },
      {
        name: 'Applies a discount code',
        steps: ['open cart', 'apply code SAVE10'],
        expectedResult: 'total is reduced by 10%',
        status: 'fail',
      },
    ],
  }),
});`,
            },
            {
              language: 'python',
              label: 'Python',
              code: `import os
import requests

response = requests.post(
    "${API_BASE_URL_TOKEN}/runs/ingest",
    headers={"Authorization": f"Bearer {os.environ['QABLY_API_KEY']}"},
    json={
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
            {"name": "Adds an item to the cart", "status": "pass"},
            {
                "name": "Applies a discount code",
                "steps": ["open cart", "apply code SAVE10"],
                "expectedResult": "total is reduced by 10%",
                "status": "fail",
            },
        ],
    },
)
response.raise_for_status()`,
            },
          ],
        },
        {
          type: 'table',
          headers: ['Campo', 'Obligatorio', 'Notas'],
          rows: [
            ['externalId', 'sí', 'Cadena no vacía. Clave de idempotencia para actualizar ejecuciones existentes en lugar de duplicarlas.'],
            ['source', 'no', '"api" (valor por defecto) o "github_actions".'],
            ['suiteId / suiteName', 'exactamente uno', 'Un suiteId inexistente devuelve 404. Un suiteName inexistente crea la suite automáticamente.'],
            ['name', 'sí', 'Nombre descriptivo de la ejecución, hasta 200 caracteres.'],
            ['startedAt / finishedAt', 'no', 'Marcas temporales ISO 8601 con zona horaria explícita.'],
            ['commitSha / commitMessage / commitAuthor', 'no', 'Metadatos opcionales del commit, hasta 64, 2000 y 200 caracteres respectivamente.'],
            ['cases', 'sí', 'Arreglo con al menos un caso de prueba.'],
          ],
        },
        {
          type: 'table',
          headers: ['Campo del caso', 'Obligatorio', 'Notas'],
          rows: [
            ['name', 'sí', 'Hasta 120 caracteres.'],
            ['suiteName', 'no', 'Hereda el nombre de la suite resuelta; permite conservar etiquetas adicionales (como proyectos de Playwright) para trazabilidad.'],
            ['steps', 'no', 'Arreglo de texto de hasta 50 elementos (máximo 500 caracteres por elemento). JUnit XML no incluye este campo, por lo que llega vacío por defecto salvo cuando se envía JSON directamente.'],
            ['expectedResult', 'no', 'Hasta 1000 caracteres. Llega vacío por defecto al importar desde JUnit XML.'],
            ['status', 'sí', 'Valores permitidos: pending, running, pass, fail, skip, blocked.'],
            ['recordedAt', 'no', 'Marca temporal ISO 8601 con zona horaria explícita.'],
          ],
        },
        {
          type: 'paragraph',
          text: 'El estado general de la ejecución se evalúa en el servidor y no depende de valores calculados por el cliente. Si un caso de prueba falla, la ejecución se marca como fallida. Si existen casos pendientes o en progreso sin fallos, la ejecución permanece en estado de ejecución. La ejecución finaliza como exitosa cuando al menos un caso concluye en pass o skip. Una ejecución donde todos los casos están bloqueados se califica como fallida, ya que ninguna validación fue completada.',
        },
        {
          type: 'paragraph',
          text: 'Reutilizar la combinación de proyecto, origen y externalId actualiza los datos existentes sin crear duplicados: la lista de casos se reemplaza íntegramente y los metadatos opcionales se actualizan si se incluyen en la nueva petición. El endpoint responde 200 OK tanto en la creación inicial como en actualizaciones.',
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
          text: 'Permite enviar archivos JUnit XML en formato original para su análisis en el servidor. Utiliza las mismas credenciales de autenticación que POST /runs/ingest.',
        },
        {
          type: 'paragraph',
          text: 'El cuerpo de la petición contiene el archivo XML directo con cabecera Content-Type en application/xml o text/xml (hasta 10 MB). Los parámetros de configuración se transmiten mediante la cadena de consulta (query string).',
        },
        {
          type: 'table',
          headers: ['Parámetro de consulta', 'Obligatorio', 'Notas'],
          rows: [
            ['externalId', 'sí', 'Clave de idempotencia idéntica a POST /runs/ingest.'],
            ['source', 'no', '"api" (valor por defecto) o "github_actions".'],
            ['suiteId / suiteName', 'no', 'Mismas reglas de resolución que en JSON. Si se omiten ambos, el nombre de la suite se toma del atributo name en <testsuite>.'],
            ['name', 'no', 'Si se omite, adopta el nombre de la suite del reporte.'],
            ['startedAt / finishedAt / commitSha / commitMessage / commitAuthor', 'no', 'Campos equivalentes a POST /runs/ingest.'],
          ],
        },
        {
          type: 'code',
          language: 'shell',
          code: `curl --fail --silent \\
  --request POST \\
  "${API_BASE_URL_TOKEN}/runs/ingest/junit?externalId=ci-42" \\
  --header "Authorization: Bearer $QABLY_API_KEY" \\
  --header "Content-Type: application/xml" \\
  --data-binary @junit.xml`,
        },
        {
          type: 'paragraph',
          text: 'El título de cada caso se extrae del atributo name en <testcase>. El atributo classname solo se utiliza como valor de respaldo si name está ausente. Los archivos con sintaxis XML inválida o cuerpos vacíos reciben una respuesta HTTP 400.',
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
          text: 'El parámetro :provider acepta los valores github o bitbucket (indistinto de mayúsculas). Este endpoint no utiliza API keys: cada entrega se valida mediante el secreto HMAC configurado para la conexión del repositorio.',
        },
        {
          type: 'table',
          headers: ['', 'GitHub', 'Bitbucket'],
          rows: [
            ['Encabezado de firma', 'x-hub-signature-256 (formato sha256=<hex>)', 'x-hub-signature (formato sha256=<hex>)'],
            ['Encabezado de evento', 'x-github-event: push o pull_request', 'x-event-key: repo:push, pullrequest:created o pullrequest:updated'],
            ['Encabezado de id de entrega', 'x-github-delivery', 'x-request-uuid'],
            ['Acciones de pull request manejadas', 'opened, synchronize', 'created, updated'],
          ],
        },
        {
          type: 'table',
          headers: ['Respuesta', 'Significado'],
          rows: [
            ['202, { "status": "accepted" }', 'Firma válida. Evento almacenado y encolado para su procesamiento.'],
            ['202, { "status": "duplicate" }', 'El par (proveedor, id de entrega) ya fue procesado. Las entregas repetidas son idempotentes.'],
            ['202, { "status": "ignored" }', 'Firma válida pero tipo de evento no soportado por Qably.'],
            ['404', 'Proveedor no reconocido en la ruta.'],
            ['401', 'Fallo de verificación de firma contra las conexiones del repositorio.'],
            ['400', 'Cuerpo de la petición inválido o JSON mal formado.'],
          ],
        },
        {
          type: 'paragraph',
          text: 'Límite de tasa de 60 peticiones por minuto por instancia. Los eventos aceptados se procesan en segundo plano de manera asíncrona. La respuesta HTTP confirma la recepción correcta del evento, no la conclusión de su procesamiento.',
        },
        {
          type: 'subheading',
          text: 'Rotación del secreto',
        },
        {
          type: 'paragraph',
          text: 'Cada conexión almacena su propio secreto HMAC. Si el secreto en el proveedor difiere del registrado en Qably, las entregas responderán con código 401. Al solicitar la rotación, Qably genera un nuevo valor, lo almacena cifrado y lo retorna en la respuesta por única vez.',
        },
        {
          type: 'table',
          headers: ['Acción', 'Endpoint', 'Rol requerido'],
          rows: [
            ['Rotar el secreto del webhook', 'POST /projects/:projectId/repository/webhook-secret', 'owner o admin'],
          ],
        },
        {
          type: 'paragraph',
          text: 'La respuesta HTTP 201 entrega el objeto { "webhookSecret": "<64 caracteres hexadecimales>" }. Este valor debe copiarse inmediatamente en la configuración del webhook en el repositorio. El secreto anterior queda invalidado al instante. Solicitar la rotación en un proyecto sin repositorio vinculado responde con código 404.',
        },
        {
          type: 'callout',
          tone: 'warning',
          text: 'La rotación de secretos también está disponible desde la pestaña Repositorio en la consola de Qably. Durante el lapso entre la rotación y la actualización en el proveedor, las entregas entrantes fallarán con error 401 y deberán reenviarse desde el panel de entregas del proveedor.',
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
          text: 'Las claves siguen la estructura qbly_<lookupId>_<secret>. Incorporan un prefijo constante, un identificador público de 6 bytes para ubicar el registro y un secreto criptográfico de 32 bytes para la autenticación. Qably almacena únicamente el hash SHA-256 y realiza comprobaciones en tiempo constante. El token en texto plano no puede recuperarse tras su emisión.',
        },
        {
          type: 'table',
          headers: ['Acción', 'Endpoint', 'Rol requerido'],
          rows: [
            ['Listar keys', 'GET /projects/:projectId/api-keys', 'Cualquier miembro de la organización'],
            ['Crear una key', 'POST /projects/:projectId/api-keys (cuerpo: { "name": string })', 'owner o admin'],
            ['Revocar una key', 'POST /projects/:projectId/api-keys/:id/revoke', 'owner o admin'],
          ],
        },
        {
          type: 'paragraph',
          text: 'Las claves revocadas permanecen archivadas en el sistema para conservar la trazabilidad de las ejecuciones históricas. Se envían en el encabezado Authorization: Bearer qbly_<lookupId>_<secret>.',
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
          text: 'Variables requeridas en los entornos de CI para la integración con Qably:',
        },
        {
          type: 'table',
          headers: ['Variable', 'Obligatoria', 'Notas'],
          rows: [
            ['QABLY_API_KEY', 'sí (para reportar datos)', 'Clave de autenticación del proyecto en CI. Si no está configurada, las peticiones sin autenticar se rechazan con código 401.'],
            ['QABLY_API_BASE_URL', 'no', `Por defecto apunta a ${API_BASE_URL_TOKEN}. Puede configurarse para instancias privadas o pruebas locales contra http://localhost:3001.`],
          ],
        },
      ],
    },
    {
      id: 'notifications-discord-slack',
      navLabel: 'Discord y Slack',
      title: 'Notificar por Discord o Slack',
      blocks: [
        {
          type: 'paragraph',
          text: 'Qably puede enviar alertas a canales de Discord o espacios de trabajo de Slack ante eventos de ejecuciones fallidas o exitosas, regresiones de casos, fallos de ingesta y cambios en credenciales de conexión. Los webhooks se gestionan en las plataformas de destino; Qably únicamente despacha las notificaciones hacia la URL configurada.',
        },
        {
          type: 'logoRow',
          items: [
            { src: '/tech-icons/discord.svg', alt: 'Logo de Discord', label: 'Discord' },
            { src: '/tech-icons/slack.svg', alt: 'Logo de Slack', label: 'Slack' },
          ],
        },
        {
          type: 'callout',
          tone: 'info',
          text: 'Si un webhook se elimina o regenera en Discord o Slack, las entregas fallarán hasta que se actualice la URL en la configuración de Qably o se desvincule el canal.',
        },
        { type: 'subheading', text: 'Obtener una URL de webhook de Discord' },
        {
          type: 'list',
          ordered: true,
          items: [
            'En el servidor de Discord donde desea recibir alertas, abra Configuración del servidor > Integraciones > Webhooks.',
            'Seleccione Nuevo Webhook, asigne el canal deseado y copie la URL generada.',
          ],
        },
        { type: 'subheading', text: 'Obtener una URL de webhook de Slack' },
        {
          type: 'list',
          ordered: true,
          items: [
            'Cree o configure una aplicación en api.slack.com/apps y active la función Incoming Webhooks.',
            'Instale la app en su espacio de trabajo, seleccione el canal y copie la URL asignada por Slack.',
          ],
        },
        { type: 'subheading', text: 'Conectarlo a Qably' },
        {
          type: 'list',
          ordered: true,
          items: [
            'En Configuración > Integraciones, dentro de Canales de notificación del equipo, seleccione Agregar canal.',
            'Seleccione Discord o Slack, asigne un nombre al canal, pegue la URL del webhook y marque los eventos correspondientes.',
            'Utilice la opción de envío de prueba para verificar la recepción del mensaje antes de activar el canal.',
          ],
        },
        {
          type: 'table',
          headers: ['Evento', 'Se dispara cuando'],
          rows: [
            ['Ejecución fallida', 'La ejecución concluye con al menos una prueba fallida.'],
            ['Ejecución completada', 'La ejecución concluye con todas las pruebas aprobadas.'],
            ['Caso con regresión', 'Una prueba que previamente pasaba falla en la ejecución actual.'],
            ['Ingesta fallida', 'Ocurre un error al procesar los cambios de código del repositorio.'],
            ['Seguridad de la conexión', 'Se modifica el secreto del webhook o las credenciales vinculadas al repositorio.'],
          ],
        },
        {
          type: 'callout',
          tone: 'info',
          text: 'La administración de canales de notificación requiere rol de owner o admin en la organización. Una vez activo, las alertas de seguridad de conexión serán visibles para cualquier usuario con acceso al canal o servidor de destino, ya que Qably no valida permisos en la plataforma receptora.',
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
              question: '¿Por qué mi pipeline de CI finaliza con éxito pero no aparece la ejecución en Qably?',
              answer: [
                {
                  type: 'paragraph',
                  text: 'Verifique que la variable QABLY_API_KEY esté declarada como secreto en el entorno del job de CI y que el paso de reporte se haya ejecutado. Al incluir la directiva if: always(), el envío se realiza incluso si las pruebas fallaron.',
                },
                {
                  type: 'paragraph',
                  text: 'Confirme además que su ejecutor de pruebas generó el archivo XML en la ruta indicada antes de la petición. Si la llamada con curl devuelve un código HTTP de error (como 401 por una clave revocada o 400 por un archivo XML mal formado), revise los registros del runner para confirmar el motivo exacto.',
                },
              ],
            },
            {
              question: '¿Cómo organiza Qably las suites y casos de prueba si no especifico identificadores manuales?',
              answer: [
                {
                  type: 'paragraph',
                  text: 'Al importar un reporte JUnit XML, Qably lee los atributos del archivo para identificar cada suite y cada caso. Si una suite con ese nombre no existe en el proyecto, el servidor la crea de inmediato y le asigna los casos correspondientes.',
                },
                {
                  type: 'paragraph',
                  text: 'No es necesario registrar previamente las pruebas en la interfaz web ni gestionar identificadores numéricos. Si envía datos mediante la API JSON en lugar de XML, use el campo suiteName para que el sistema adopte o cree la suite de forma automática.',
                },
              ],
            },
            {
              question: '¿Qué sucede en Qably si reintento un job de pruebas en mi CI?',
              answer: [
                {
                  type: 'paragraph',
                  text: 'Qably maneja reintentos de forma idempotente cuando se incluye el parámetro externalId en la llamada. Al utilizar identificadores únicos provistos por el runner (como el número de ejecución y el nombre del job en GitHub Actions), el servidor actualiza el registro existente en lugar de crear una ejecución duplicada.',
                },
                {
                  type: 'paragraph',
                  text: 'Esto garantiza que las métricas de aprobación reflejen el estado definitivo de la corrida sin distorsionar el historial del proyecto ni duplicar conteos de pruebas.',
                },
              ],
            },
            {
              question: '¿Puedo registrar pasos individuales y resultados esperados al importar desde JUnit XML?',
              answer: [
                {
                  type: 'paragraph',
                  text: 'El estándar JUnit XML registra únicamente el estado final de cada prueba (aprobada, fallida u omitida), su duración y el mensaje de error o traza del fallo. Por esta razón, las importaciones desde archivos XML dejan vacíos los campos de pasos y resultados esperados.',
                },
                {
                  type: 'paragraph',
                  text: 'Para documentar procedimientos detallados con pasos individuales y resultados previstos, envíe los datos en formato JSON directamente al endpoint POST /runs/ingest, o gestione casos estructurados desde la interfaz web del proyecto.',
                },
              ],
            },
            {
              question: '¿Por qué la sección Repository del proyecto no muestra commits ni ramas?',
              answer: [
                {
                  type: 'paragraph',
                  text: 'La vista Repository se alimenta exclusivamente mediante el webhook del sistema de control de versiones (GitHub o Bitbucket). El envío de reportes de pruebas desde CI registra ejecuciones en el historial, pero no transmite el contenido de los commits ni la actividad del repositorio.',
                },
                {
                  type: 'paragraph',
                  text: 'Para ver los cambios de código y vincularlos con las corridas de pruebas, configure el webhook en los ajustes de su repositorio siguiendo el paso 2 de esta guía.',
                },
              ],
            },
            {
              question: '¿Puede una misma API key reportar resultados a varios proyectos?',
              answer: [
                {
                  type: 'paragraph',
                  text: 'No. Cada API key tiene alcance exclusivo sobre un proyecto específico dentro de la organización. El servidor deduce el proyecto de destino a partir de la propia clave y restringe su uso a la ingesta de pruebas.',
                },
                {
                  type: 'paragraph',
                  text: 'Para entornos con múltiples proyectos o arquitecturas basadas en microservicios, genere una clave independiente para cada proyecto y configure el secreto correspondiente en sus flujos de CI.',
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};
