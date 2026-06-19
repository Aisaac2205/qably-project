# Qably - Enterprise Monorepo

Bienvenidos al repositorio central de **Qably**. Este proyecto implementa una arquitectura Clean/Modular distribuida en un monorepo gestionado por `pnpm workspaces` (y orquestado por `turbo`).

Nuestro objetivo acá no es solo "escribir código que ande", es construir un producto estable, testeable y mantenible por cualquier ingeniero que entre mañana al equipo. Todo el sistema sigue el principio de **Explicit over Implicit** (Cero Magia) y estrictos contratos de tipado.

---

## 🏗️ Estructura Arquitectónica

Diseñamos el sistema separando claramente las responsabilidades. El código no se mezcla; cada paquete tiene un propósito bien definido.

### 💻 Aplicaciones (`apps/`)

*   **`apps/web`** (Frontend)
    *   **Stack:** Next.js 15+ (App Router), React 19, Tailwind CSS v4.
    *   **Responsabilidad:** Rendereo en el servidor (RSC) para mejorar performance y SEO, Client Components estrictamente para interactividad, e integraciones con Server Actions para mutaciones simples o consultas al back.
    *   **Regla de Oro:** La lógica de negocio pesada **no** vive acá. Es una capa de presentación.

*   **`apps/api`** (Backend)
    *   **Stack:** NestJS, TypeScript 5.x.
    *   **Responsabilidad:** Corazón de negocio. Controladores (HTTP/Routing), Servicios (Reglas y Orquestación) y Repositorios (Data Access).
    *   **Regla de Oro:** Los Controladores jamás tocan la base de datos de manera directa; dependen exclusivamente del servicio subyacente. Los errores son capturados globalmente.

### 📦 Paquetes Compartidos (`packages/`)

Los paquetes permiten compartir configuraciones, componentes y reglas de negocio. Esto elimina código duplicado y centraliza las decisiones de arquitectura.

*   **`packages/types`** (El Contrato Central)
    *   Define las interfaces base, DTOs compartidos y enumeradores (ej. `Organization`, `Project`, `UserRole`, `TestRun`).
    *   *¿Por qué?* Evita que el front adivine qué devuelve el back. El backend exporta su contrato y el frontend lo consume (vía `transpilePackages`). Si rompemos una API en el back, el front estalla en tiempo de compilación.

*   **`packages/config`** (Gobernanza de Estilo)
    *   Maneja configuraciones pilar (como `tsconfig.base.json`, linter compartidos, etc.).
    *   *¿Por qué?* Asegura que todo el monorepo (incluso nuevos módulos) respete tolerancias cero como `strict: true` y `noImplicitReturns`.

*   **`packages/ui`** *(Pendiente/En progreso)*
    *   Librería de componentes puros y agnósticos (botones, formularios, modales).
    *   *¿Por qué?* Estandarizamos nuestra identidad visual. La web solo consume componentes pre-fabricados y encapsulados siguiendo una arquitectura Atómica o de Componente/Contenedor.

---

## ⚠️ Reglas Core del Repositorio (Tolerancia Cero)

Como Tech Leads, hay pautas irreductibles para hacer commit en este repo. Todo PR que la incumpla será rebotado:

1.  **Chau `any` y `unknown` ciego:** TypeScript es un contrato, no una sugerencia. Si usás tipo dinámico, necesitás validarlo a la entrada (ej. con Zod) o implementar _type narrowing_.
2.  **Clean Code en NestJS:**
    *   Controlador = Entradas HTTP, Parseo, Salida.
    *   Servicio = Business Logic (Decisiones).
    *   Capa de Datos = Abstracciones seguras.
3.  **Hooks y SRP:** Si un componente de React tiene más de 50 líneas, la lógica (estados, fetches) probablemente necesite estar abstraída en un Custom Hook (`useMiFormulario`, `useTestCases`).
4.  **Conventional Commits:** Los commits se escriben en Español, modo imperativo (`feat(auth): agregar validación de org de Zod`, o `fix(ui): alinear tabla de casos`). Nada de "cambios", o "arreglé el bug".

---

## 🚀 Cómo Empezar Localmente

**Requisitos:** Node.js (v20+ recomendado), `pnpm` activado globalmente.

1.  **Clonar e Instalar:**
    ```powershell
    git clone ...
    cd Qably
    pnpm install
    ```
    *(Nunca uses `npm` en el monorepo ya que todo el sistema de `workspace:*` cuenta nativamente con la resolución de pnpm).*

2.  **Correr Ambientes Simultáneos (vía Turbo):**
    ```powershell
    pnpm run dev
    ```
    *(Esto inicializará paralelamente `apps/web` y `apps/api`).*

---

> _"El código se escribe para el próximo ingeniero, no para el compilador. Diseñemos sistemas, no un conjunto de scripts sueltos."_
