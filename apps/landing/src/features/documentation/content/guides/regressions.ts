import type { GuidePair } from './types';

const REPORT_QUERY =
  'externalId=gha-${{ github.run_id }}-${{ github.job }}&source=github_actions&commitSha=${{ github.event.pull_request.head.sha || github.sha }}';

export const regressions: GuidePair = {
  es: {
    slug: 'regressions',
    navLabel: 'Regresiones',
    title: 'Cómo leer una regresión y sus commits candidatos',
    description:
      'Cuándo Qably marca una regresión, qué es el rango de commits candidatos, qué necesita para mostrarlo y qué hacer cuando no puede.',
    sections: [
      {
        id: 'regressions',
        navLabel: 'Regresiones',
        title: 'Cómo leer una regresión y sus commits candidatos',
        blocks: [
          {
            type: 'paragraph',
            text: 'Una regresión es un caso que dejó de pasar. Qably la marca y, cuando puede, lista los commits que llegaron entre las dos ejecuciones. Lea esa lista como un conjunto de pistas, no como una respuesta.',
          },
          { type: 'subheading', text: 'Qué cuenta como regresión' },
          {
            type: 'paragraph',
            text: 'Qably compara cada ejecución terminada con la **ejecución terminada anterior de la misma suite**. Un caso es una regresión cuando pasó en esa ejecución y falla en esta. El cambio contrario, de falla a éxito, es un arreglo. Un caso que antes estaba omitido o bloqueado, o que es nuevo en esta ejecución, no es ninguna de las dos cosas.',
          },
          { type: 'paragraph', text: 'Se ve en tres lugares:' },
          {
            type: 'list',
            items: [
              '**Lista de ejecuciones:** cada ejecución muestra tres conteos frente a la anterior: regresiones, arreglos y casos sin cambio.',
              '**Detalle de la ejecución:** el bloque **Qué cambió** lista los casos bajo "Empezaron a fallar" y "Se arreglaron".',
              '**Notificación:** **Caso con regresión** se envía solo cuando alguien registra a mano un resultado fallido en una ejecución manual. Las ejecuciones reportadas desde CI envían Ejecución fallida o Ejecución completada.',
            ],
          },
          { type: 'subheading', text: 'Qué son los commits candidatos y qué no son' },
          {
            type: 'paragraph',
            text: 'Bajo esas listas, **Commits candidatos** muestra los commits que Qably recibió en pushes entre la ejecución anterior y esta, del más reciente al más antiguo: los cinco más recientes, cada uno con sha corto, primera línea del mensaje, autor, rama y fecha, y un botón para ver los más antiguos. Aparece solo cuando la ejecución tiene al menos una regresión o un arreglo.',
          },
          {
            type: 'callout',
            tone: 'warning',
            text: 'La lista nunca dice qué commit causó la falla. Contiene todos los commits recibidos entre las dos ejecuciones, hayan tocado o no el código detrás del caso que falla.',
          },
          {
            type: 'paragraph',
            text: 'Cuando ambas ejecuciones reportan el mismo commit, el bloque dice **Ambas ejecuciones usaron el mismo commit**: el código no cambió, así que revise la prueba y el entorno, y la señal **Inestable** descrita en [cómo leer las señales de un caso](/docs/case-health).',
          },
          { type: 'subheading', text: 'Qué necesita para funcionar' },
          {
            type: 'paragraph',
            text: 'La lista es tan buena como lo que Qably registró. Deben cumplirse tres condiciones:',
          },
          {
            type: 'list',
            items: [
              'El proyecto tiene un repositorio de GitHub conectado, para que Qably reciba sus pushes. Vea el [paso 2 del inicio rápido](/docs/quickstart#step-2-connect-repository).',
              'Las dos ejecuciones reportan `commitSha`, un campo de [`POST /runs/ingest`](/docs/api-ingest) y un parámetro de consulta de `POST /runs/ingest/junit`. El flujo del [paso 4 del inicio rápido](/docs/quickstart#step-4-report-ci) no lo envía: agréguelo al paso que reporta (ejemplo tras esta lista).',
              'Los commits se enviaron con push después de conectar el repositorio. Qably reconstruye la lista con los pushes que registró su [webhook](/docs/api-webhooks); no consulta a GitHub ni recupera historial anterior.',
            ],
          },
          {
            type: 'code',
            language: 'shell',
            label: 'Cadena de consulta del paso que reporta',
            code: REPORT_QUERY,
          },
          {
            type: 'paragraph',
            text: 'La expresión usa el commit de la punta del pull request y, en un push, `github.sha`, porque en las compilaciones de pull request `github.sha` es un commit de fusión temporal que ningún push contiene.',
          },
          { type: 'subheading', text: 'Cuando Qably dice que no lo sabe' },
          {
            type: 'paragraph',
            text: 'Si los pushes registrados no demuestran una cadena desde la ejecución anterior hasta esta, Qably no adivina: el bloque muestra una línea neutral, información y no un error.',
          },
          {
            type: 'table',
            headers: ['Mensaje', 'Qué significa', 'Qué hacer'],
            rows: [
              [
                'Una de las ejecuciones no informó un commit.',
                'Una de las dos ejecuciones no tiene `commitSha`.',
                'Agréguelo al reporte. Rige desde la siguiente ejecución.',
              ],
              [
                'Este proyecto no tiene un repositorio conectado.',
                'No hay un repositorio de GitHub vinculado, así que no hay pushes que leer.',
                'Conecte uno (primera condición).',
              ],
              [
                'Un commit de estas ejecuciones no está en los pushes registrados.',
                'Ningún push registrado menciona un commit que reportó una de las ejecuciones.',
                'Busque entregas fallidas en el registro del webhook en GitHub. Reporte un commit enviado con push, no uno temporal como el de fusión de un pull request.',
              ],
              [
                'Las ejecuciones provienen de ramas distintas.',
                'El commit anterior solo se registró en ramas donde nunca se registró el de esta ejecución.',
                'No hay nada roto: la ejecución anterior está en otra línea de historial. Las ejecuciones consecutivas de una misma rama sí obtienen lista.',
              ],
              [
                'Faltan algunos pushes registrados entre estas ejecuciones.',
                'La cadena está cortada: un push no llegó, un push creó la rama entre las ejecuciones, o el historial supera los 1000 pushes más recientes que Qably lee.',
                'Busque entregas fallidas en el webhook. Los pushes faltantes no se recuperan; lea el historial en GitHub.',
              ],
              [
                'El historial se reescribió (force push) entre estas ejecuciones.',
                'Un push forzado reemplazó commits, así que no se puede confiar en los vínculos registrados.',
                'No hay nada que corregir. Lea el historial en GitHub.',
              ],
              [
                'La ejecución anterior está en un commit más nuevo que esta.',
                'La ejecución anterior, por hora de inicio, corrió un commit más nuevo que esta.',
                'Es típico al volver a correr un commit antiguo o cuando los pipelines inician fuera de orden. Compare los commits en GitHub.',
              ],
              [
                'Hay demasiados commits entre estas ejecuciones para listarlos.',
                'Llegaron más de 100 commits entre las ejecuciones.',
                'Lea el historial en GitHub y reporte con más frecuencia para que las ejecuciones queden más cerca.',
              ],
            ],
          },
          { type: 'subheading', text: 'Una rutina de cuatro pasos' },
          {
            type: 'list',
            ordered: true,
            items: [
              'Abra la ejecución y lea **Qué cambió**. ¿Los casos de "Empezaron a fallar" comparten un área o es un solo caso?',
              'Lea **Commits candidatos**, del más reciente al más antiguo, y abra los cercanos al área que falla. Si el bloque dice que no lo sabe, busque el motivo en la tabla anterior.',
              'Corra el caso que falla en su máquina con el commit de esta ejecución y con el de la anterior. Con muchos candidatos, `git bisect` acota el rango por usted.',
              'Corrija el código o la prueba. En la siguiente ejecución el caso aparece bajo "Se arreglaron". Si sigue cambiando de resultado, trátelo como inestable.',
            ],
          },
        ],
      },
    ],
  },
  en: {
    slug: 'regressions',
    navLabel: 'Regressions',
    title: 'How to read a regression and its candidate commits',
    description:
      'When Qably flags a regression, what the candidate commit range is, what it needs to show one, and what to do when it cannot.',
    sections: [
      {
        id: 'regressions',
        navLabel: 'Regressions',
        title: 'How to read a regression and its candidate commits',
        blocks: [
          {
            type: 'paragraph',
            text: 'A regression is a case that stopped passing. Qably flags it and, when it can, lists the commits that arrived between the two runs. Read that list as a set of leads, not as an answer.',
          },
          { type: 'subheading', text: 'What counts as a regression' },
          {
            type: 'paragraph',
            text: 'Qably compares each finished run with the **previous finished run of the same suite**. A case is a regression when it passed in that run and fails in this one. The opposite change, from fail to pass, is a fix. A case that was skipped or blocked before, or that is new in this run, is neither.',
          },
          { type: 'paragraph', text: 'You see it in three places:' },
          {
            type: 'list',
            items: [
              '**Run list:** each run carries three counts against the previous one: regressions, fixes and unchanged cases.',
              '**Run detail:** the **What changed** block lists the cases under "Started failing" and "Got fixed".',
              '**Notification:** **Case regressed** is sent only when someone records a failing result by hand on a manual run. Runs reported from CI send Run failed or Run completed.',
            ],
          },
          { type: 'subheading', text: 'What the candidate commits are, and what they are not' },
          {
            type: 'paragraph',
            text: 'Under those lists, **Candidate commits** shows the commits Qably received in pushes between the previous run and this one, newest first: the five newest, each with short sha, first line of the message, author, branch and date, and a button for the older ones. It appears only when the run has at least one regression or fix.',
          },
          {
            type: 'callout',
            tone: 'warning',
            text: 'The list never says which commit caused the failure. It holds every commit received between the two runs, whether or not it touched the code behind the failing case.',
          },
          {
            type: 'paragraph',
            text: 'When both runs report the same commit, the block reads **Both runs ran the same commit**: the code did not change, so look at the test and the environment, and at the **Flaky** signal described in [how to read the signals of a case](/docs/case-health).',
          },
          { type: 'subheading', text: 'What you need for it to work' },
          {
            type: 'paragraph',
            text: 'The list is only as good as what Qably recorded. Three things must be true:',
          },
          {
            type: 'list',
            items: [
              'The project has a GitHub repository connected, so Qably receives your pushes. See [step 2 of the quickstart](/docs/quickstart#step-2-connect-repository).',
              'Both runs report `commitSha`, a field of [`POST /runs/ingest`](/docs/api-ingest) and a query parameter of `POST /runs/ingest/junit`. The workflow in [step 4 of the quickstart](/docs/quickstart#step-4-report-ci) does not send it: add it to the report step (example after this list).',
              'The commits were pushed after the repository was connected. Qably rebuilds the list from the pushes its [webhook](/docs/api-webhooks) recorded; it does not ask GitHub or fetch older history.',
            ],
          },
          {
            type: 'code',
            language: 'shell',
            label: 'Query string of the report step',
            code: REPORT_QUERY,
          },
          {
            type: 'paragraph',
            text: 'The expression uses the head commit of a pull request and `github.sha` on a push, because on pull request builds `github.sha` is a temporary merge commit that no push contains.',
          },
          { type: 'subheading', text: 'When Qably says it does not know' },
          {
            type: 'paragraph',
            text: 'When the recorded pushes cannot prove a chain from the earlier run to this one, Qably does not guess: the block shows one neutral line, information rather than an error.',
          },
          {
            type: 'table',
            headers: ['Message', 'What it means', 'What to do'],
            rows: [
              [
                'One of the runs did not report a commit.',
                'One of the two runs has no `commitSha`.',
                'Add it to the report. It applies from the next run.',
              ],
              [
                'This project has no repository connected.',
                'No GitHub repository is linked, so there are no pushes to read.',
                'Connect one (first condition).',
              ],
              [
                'A commit of these runs is not in the recorded pushes.',
                'No recorded push mentions a commit that one of the runs reported.',
                'Check the webhook log in GitHub for failed deliveries. Report a pushed commit, not a temporary one such as a pull request merge commit.',
              ],
              [
                'The runs come from different branches.',
                "The earlier commit was recorded only on branches where this run's commit never was.",
                'Nothing is broken: the previous run is on another line of history. Consecutive runs on one branch do get a list.',
              ],
              [
                'Some pushes between these runs were not recorded.',
                'The chain is cut: a push never arrived, a push created the branch between the runs, or the history is past the 1000 most recent pushes Qably reads.',
                'Check the webhook log for failed deliveries. Missing pushes are not recovered; read the history in GitHub.',
              ],
              [
                'History was rewritten (force push) between these runs.',
                'A forced push replaced commits, so the recorded links cannot be trusted.',
                'Nothing to fix. Read the history in GitHub.',
              ],
              [
                'The earlier run is on a newer commit than this one.',
                'The previous run, by start time, ran a newer commit than this run.',
                'Typical after re-running an old commit or when pipelines start out of order. Compare the commits in GitHub.',
              ],
              [
                'Too many commits between these runs to list.',
                'More than 100 commits arrived between the runs.',
                'Read the history in GitHub and report more often so runs sit closer together.',
              ],
            ],
          },
          { type: 'subheading', text: 'A four-step routine' },
          {
            type: 'list',
            ordered: true,
            items: [
              'Open the run and read **What changed**. Do the cases under "Started failing" share an area, or is it a single case?',
              'Read **Candidate commits**, newest first, and open the ones close to the failing area. If the block says it does not know, find the reason in the table above.',
              'Run the failing case on your machine at the commit of this run and at the commit of the previous one. With many candidates, `git bisect` narrows the range for you.',
              'Fix the code or the test. In the next run the case shows under "Got fixed". If it keeps flipping, treat it as flaky.',
            ],
          },
        ],
      },
    ],
  },
};
