import type { GuidePair } from './types';

export const caseHealth: GuidePair = {
  es: {
    slug: 'case-health',
    navLabel: 'Señales de un caso',
    title: 'Cómo leer las señales de un caso',
    description:
      'Qué significa cada una de las cinco señales de un caso en una suite de Qably, cuándo aparece y una rutina breve para revisarlas.',
    sections: [
      {
        id: 'case-health',
        navLabel: 'Señales de un caso',
        title: 'Cómo leer las señales de un caso',
        blocks: [
          {
            type: 'paragraph',
            text: 'Qably revisa cada caso de una suite con cinco reglas fijas y muestra una etiqueta cuando una se cumple. Una señal indica qué caso conviene abrir a continuación; no dice que el producto esté roto. Las reglas leen solo nombres, pasos, claves de automatización y resultados recientes, así que los mismos datos siempre producen las mismas señales.',
          },
          { type: 'subheading', text: 'Dónde aparecen las señales' },
          {
            type: 'paragraph',
            text: 'Abra una suite de su proyecto. Sobre la lista de casos, una franja muestra cada señal con el número de casos que la activan, y cada tarjeta de caso repite sus propias etiquetas. Pase el cursor sobre una etiqueta, o enfóquela, para leer su explicación breve. Un caso automatizado sin pasos ni resultado esperado muestra **Sin documentar** en su tarjeta, en lugar de la etiqueta **Sin pasos**.',
          },
          { type: 'subheading', text: 'Las cinco señales' },
          {
            type: 'table',
            headers: ['Señal', 'Cuándo aparece', 'Qué sugiere', 'Qué hacer'],
            rows: [
              [
                'Sin pasos',
                'Un caso automatizado no tiene pasos registrados. Los casos manuales nunca se marcan.',
                'Los resultados llegan, pero nadie sabe qué comprueba la prueba.',
                'Escriba los pasos y el resultado esperado. Vea la guía para [escribir un caso de prueba](/docs/write-a-case).',
              ],
              [
                'Nombre técnico',
                'El nombre no tiene espacios, parece un identificador de código y contiene un guion bajo o mezcla mayúsculas y minúsculas, como `test_login_1` o `testTokenNull`. También cuenta un nombre igual a la clave de automatización del caso.',
                'Solo quien escribió la prueba puede leerla en un reporte.',
                'Renómbrelo como una frase que diga qué hace la persona usuaria. Vea [cómo nombrar las pruebas](/docs/naming-tests).',
              ],
              [
                'Inestable',
                'Los últimos 6 resultados de un caso automatizado en ejecuciones terminadas, sin contar los omitidos ni los bloqueados, cambian entre éxito y falla al menos dos veces, como éxito, falla, éxito.',
                'El resultado puede depender del tiempo, del orden de las pruebas, de datos compartidos o del entorno, y no del código probado.',
                'Compare una ejecución exitosa con una fallida del caso, busque qué cambia y corrija la prueba antes de confiar en su estado.',
              ],
              [
                'Clave duplicada',
                'Otro caso del mismo proyecto tiene la misma clave de automatización, la que Qably usa para vincular un resultado con un caso.',
                'La misma prueba está registrada como dos casos, en suites distintas del proyecto, y uno de ellos probablemente quedó obsoleto.',
                'Abra ambos, conserve el que sigue recibiendo resultados y elimine el otro. Para saber cómo una prueba se convierte en caso, vea [la referencia de JUnit](/docs/api-ingest-junit).',
              ],
              [
                'Título casi duplicado',
                'Otro caso de la misma suite tiene el mismo título una vez que se ignoran mayúsculas, signos de puntuación y espacios sobrantes.',
                'Dos casos se leen igual, así que una falla en un reporte resulta ambigua.',
                'Renómbrelos para que cada uno diga qué comprueba, o elimine el repetido. La guía sobre [qué tipos de errores buscar](/docs/what-to-test) ayuda a decidir qué casos valen la pena.',
              ],
            ],
          },
          { type: 'subheading', text: 'Inestable es una pista, no un veredicto' },
          {
            type: 'paragraph',
            text: 'Un caso inestable pasa y falla sin un cambio que se pueda señalar, así que una ejecución en rojo puede no ser una regresión. Tampoco llevan la señal un caso que cambia de resultado una sola vez, por ejemplo de éxito a falla (eso es una regresión, no inestabilidad), ni un caso que falla siempre.',
          },
          {
            type: 'callout',
            tone: 'warning',
            text: '**Inestable** solo marca el caso. Qably no lo aísla, no lo omite ni lo oculta: sus resultados siguen contando en cada ejecución tal como los reportó su CI.',
          },
          { type: 'subheading', text: 'Una rutina para revisar una suite' },
          {
            type: 'list',
            ordered: true,
            items: [
              'Abra la suite y lea la franja sobre los casos. Anote qué señal tiene el conteo más alto.',
              'Corrija primero los duplicados: **Clave duplicada** y **Título casi duplicado**. Las demás señales se leen mejor cuando cada prueba es un solo caso.',
              'Revise después los casos **Inestable**. Compare una ejecución exitosa con una fallida y corrija la prueba o los datos de los que depende.',
              'Limpie luego **Sin pasos** y **Nombre técnico** en lotes pequeños, por ejemplo cada vez que toque el archivo de la prueba.',
              'Si un caso que siempre pasaba ahora falla, es una regresión. Continúe con la guía para [leer una regresión y sus commits candidatos](/docs/regressions).',
            ],
          },
        ],
      },
    ],
  },
  en: {
    slug: 'case-health',
    navLabel: 'Case signals',
    title: 'How to read the signals of a case',
    description:
      'What the five case signals in a Qably suite mean, when each one appears, and a short routine to triage them.',
    sections: [
      {
        id: 'case-health',
        navLabel: 'Case signals',
        title: 'How to read the signals of a case',
        blocks: [
          {
            type: 'paragraph',
            text: 'Qably checks every case in a suite against five fixed rules and shows a chip when one applies. A signal tells you which case to open next; it does not say your product is broken. The rules read only names, steps, automation keys and recent results, so the same data always gives the same signals.',
          },
          { type: 'subheading', text: 'Where the signals appear' },
          {
            type: 'paragraph',
            text: 'Open a suite in your project. Above the case list, a strip shows each signal with the number of cases that trip it, and each case card repeats its own chips. Hover over or focus a chip to read its short explanation. An automated case with neither steps nor expected result shows **Undocumented** on its card, instead of a **No steps** chip.',
          },
          { type: 'subheading', text: 'The five signals' },
          {
            type: 'table',
            headers: ['Signal', 'When it appears', 'What it suggests', 'What to do'],
            rows: [
              [
                'No steps',
                'An automated case has no recorded steps. Manual cases are never flagged.',
                'Results arrive, but nobody can tell what the test checks.',
                'Write the steps and the expected result. See the guide on [writing a test case](/docs/write-a-case).',
              ],
              [
                'Raw name',
                "The name has no spaces, looks like a code identifier and either contains an underscore or mixes upper and lower case, as in `test_login_1` or `testTokenNull`. A name equal to the case's automation key also counts.",
                'Only the person who wrote the test can read it in a report.',
                'Rename it as a phrase that says what the user does. See [naming tests](/docs/naming-tests).',
              ],
              [
                'Flaky',
                'The last 6 results of an automated case in finished runs, leaving out skipped and blocked ones, switch between pass and fail at least twice, as in pass, fail, pass.',
                'The result may depend on timing, test order, shared data or the environment rather than on the code under test.',
                'Compare a passing and a failing run of the case, find what differs and fix the test before you trust its status.',
              ],
              [
                'Duplicate key',
                'Another case in the same project has the same automation key, the one Qably uses to link a result to a case.',
                'The same test is registered as two cases, in different suites of the project, and one of them is probably stale.',
                'Open both, keep the one that still receives results and delete the other. To see how a test becomes a case, read [the JUnit reference](/docs/api-ingest-junit).',
              ],
              [
                'Near-duplicate title',
                'Another case in the same suite has the same title once capitals, punctuation and extra spaces are ignored.',
                'Two cases read the same, so a failure in a report is ambiguous.',
                'Rename them so each says what it checks, or delete the repeated one. The guide on [what kinds of errors to look for](/docs/what-to-test) helps you decide which cases earn a place.',
              ],
            ],
          },
          { type: 'subheading', text: 'Flaky is a hint, not a verdict' },
          {
            type: 'paragraph',
            text: 'A flaky case passes and fails without a change you can point at, so a red run may not be a regression. A case that changes result only once, for example from passing to failing, does not carry the signal: that is a regression, not flakiness. Neither does a case that fails every time.',
          },
          {
            type: 'callout',
            tone: 'warning',
            text: '**Flaky** only marks the case. Qably does not isolate, skip or hide it: its results keep counting in every run exactly as your CI reported them.',
          },
          { type: 'subheading', text: 'A routine to triage a suite' },
          {
            type: 'list',
            ordered: true,
            items: [
              'Open the suite and read the strip above the cases. Note which signal has the highest count.',
              'Fix duplicates first: **Duplicate key** and **Near-duplicate title**. Every other signal is easier to read when each test is one case.',
              'Look at **Flaky** cases next. Compare a passing and a failing run, and fix the test or the data it depends on.',
              'Then clear **No steps** and **Raw name** in small batches, for example whenever you touch the test file.',
              'If a case that always passed now fails, that is a regression. Continue with the guide on [reading a regression and its candidate commits](/docs/regressions).',
            ],
          },
        ],
      },
    ],
  },
};
