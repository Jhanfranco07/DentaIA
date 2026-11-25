type Punto = { x: number; y: number };
export type Boca = Punto & { ancho: number; alto: number; angulo: number };
export type Indicacion = "buscar" | "centrar" | "enderezar" | "acercar" | "alejar" | "abrir" | "lista";
export type Senal = { indicacion: Indicacion; boca: Boca | null };

export const BUSCAR: Senal = { indicacion: "buscar", boca: null };
export const OBJETIVO = { x: .5, y: .66 };

export function evaluarEncuadre(puntos: readonly Punto[] | undefined, ancho: number, alto: number): Senal {
  if (!puntos || ancho <= 0 || alto <= 0) return BUSCAR;
  const [izq, der, labioSuperior, labioInferior, frente, menton, mejillaIzq, mejillaDer, nariz] =
    [61, 291, 13, 14, 10, 152, 234, 454, 1].map(i => puntos[i]);
  if (![izq, der, labioSuperior, labioInferior, frente, menton, mejillaIzq, mejillaDer, nariz]
    .every(p => p && Number.isFinite(p.x) && Number.isFinite(p.y))) return BUSCAR;

  const dx = (der.x - izq.x) * ancho;
  const dy = (der.y - izq.y) * alto;
  const anchoBoca = Math.hypot(dx, dy);
  if (anchoBoca < 1) return BUSCAR;
  const angulo = Math.atan2(dy, dx);
  const apertura = Math.abs(
    ((labioInferior.y - labioSuperior.y) * alto * dx - (labioInferior.x - labioSuperior.x) * ancho * dy) / anchoBoca ** 2,
  );
  const boca = {
    x: (izq.x + der.x) / 2,
    y: (izq.y + der.y) / 2,
    ancho: anchoBoca * 1.25 / ancho,
    alto: anchoBoca * Math.max(.28, apertura + .2) / alto,
    angulo,
  };

  const largoRostro = Math.hypot((menton.x - frente.x) * ancho, (menton.y - frente.y) * alto) / alto;
  const centroMejillas = (mejillaIzq.x + mejillaDer.x) / 2;
  const desviacionNariz = Math.abs(nariz.x - centroMejillas) / Math.max(.01, Math.abs(mejillaDer.x - mejillaIzq.x));
  let indicacion: Indicacion = "lista";
  if (Math.abs(boca.x - OBJETIVO.x) > .15 || Math.abs(boca.y - OBJETIVO.y) > .17) indicacion = "centrar";
  else if (Math.abs(angulo) > .24 || desviacionNariz > .18) indicacion = "enderezar";
  else if (largoRostro < .37) indicacion = "acercar";
  else if (largoRostro > .83) indicacion = "alejar";
  else if (apertura < .12) indicacion = "abrir";
  return { indicacion, boca };
}

export function estabilizarEncuadre() {
  let visible: Indicacion = "buscar";
  let candidata: Indicacion = "buscar";
  let repetida = 0;
  let anterior: Boca | null = null;

  return (senal: Senal): Senal => {
    if (senal.indicacion !== candidata) {
      candidata = senal.indicacion;
      repetida = 0;
    }
    if (++repetida >= 3) visible = candidata;
    let boca = senal.boca;
    if (boca && anterior) {
      const suavizar = (valor: number, previo: number) => .4 * valor + .6 * previo;
      boca = {
        x: suavizar(boca.x, anterior.x), y: suavizar(boca.y, anterior.y),
        ancho: suavizar(boca.ancho, anterior.ancho), alto: suavizar(boca.alto, anterior.alto),
        angulo: boca.angulo,
      };
    }
    anterior = boca;
    return { indicacion: visible, boca: visible === "buscar" ? null : boca };
  };
}

export function orientarBoca(boca: Boca, espejo: boolean): Boca {
  return espejo ? { ...boca, x: 1 - boca.x, angulo: -boca.angulo } : boca;
}
