
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { expect } from "playwright/test";

const url="http://localhost:57430";
const suffix=process.env.DI214_RUN;
assert.match(suffix ?? "",/^[a-z0-9]{1,12}$/);
const browser=await chromium.launch();
const patient=await browser.newPage({viewport:{width:390,height:844},acceptDownloads:true});
const dentist=await browser.newPage({viewport:{width:1280,height:900},acceptDownloads:true});
async function login(page,role) {
  await page.goto(url+"/desarrollo/acceso");
  await page.getByLabel(/correo/i).fill(role+"."+suffix+"@di214.test");
  await page.getByLabel("Contraseña").fill("DI214-local-only!542");
  await page.getByRole("button",{name:"Iniciar sesión de prueba"}).click();
  await expect(page.getByRole("button",{name:/Cerrar sesión/i})).toBeEnabled({timeout:20000});
}
try {
  const anonymous=await patient.request.post(url+"/api/patient/premium-history/read",{data:{}});
  assert.equal(anonymous.status(),401);
  await login(patient,"paciente");
  await patient.goto(url+"/resultados");
  await expect(patient.getByText("Las nuevas evaluaciones visuales Premium todavía no están disponibles.")).toBeVisible({timeout:20000});
  await expect(patient.getByText("Imagen no evaluable",{exact:false}).first()).toBeVisible();
  const items=patient.locator("[class*='evaluations'] > li");
  await expect(items).toHaveCount(7);
  const evaluated=items.filter({has:patient.locator("summary").getByText(/· Evaluación completa$/)}).first();
  const noDetection=items.filter({has:patient.locator("summary").getByText(/Evaluación completa sin detecciones/)}).first();
  await evaluated.getByRole("checkbox").check();
  await noDetection.getByRole("checkbox").check();
  await expect(patient.getByRole("table")).toBeVisible();
  await patient.reload();
  await expect(items).toHaveCount(7,{timeout:15000});
  await evaluated.locator("summary").click();
  await expect(evaluated.getByText("Cálculo dental")).toBeVisible();
  await patient.screenshot({path:"node_modules/.qa-di214/patient.png",fullPage:true});

  await login(dentist,"odontologo");
  await dentist.goto(url+"/profesional");
  const chooser=dentist.locator("#historial-clinico select");
  await expect(chooser).toBeVisible({timeout:20000});
  const first=await chooser.locator("option:not([value=''])").first().getAttribute("value");
  await chooser.selectOption(first);
  await dentist.getByRole("button",{name:"Consultar evaluaciones compartidas"}).click({timeout:20000});
  const professionalItems=dentist.locator("[class*='evaluations'] > li");
  await expect(professionalItems).toHaveCount(1);
  await professionalItems.first().locator("summary").click();
  const photoResponse=dentist.waitForResponse(response=>response.url().endsWith("/api/professional/premium-history") && Boolean(response.request().postDataJSON()?.photo));
  const downloaded=dentist.waitForEvent("download");
  await dentist.getByRole("button",{name:"Descargar fotografía privada"}).click();
  const response=await photoResponse;
  assert.equal(response.status(),200);
  assert.match(response.headers()["cache-control"],/private.*no-store/);
  assert.equal((await downloaded).suggestedFilename(),"fotografia.png");
  await dentist.screenshot({path:"node_modules/.qa-di214/dentist.png",fullPage:true});

  await evaluated.getByRole("button",{name:"Quitar evaluación de este permiso"}).click();
  await expect(patient.getByText("Cambios guardados.")).toBeVisible();
  const deniedPhoto=await dentist.request.post(response.url(),{data:response.request().postDataJSON(),headers:{"Authorization":response.request().headers()["authorization"]}});
  assert.equal(deniedPhoto.status(),403);
  await dentist.getByRole("button",{name:"Ocultar evaluaciones"}).click();
  await dentist.getByRole("button",{name:"Consultar evaluaciones compartidas"}).click();
  await expect(dentist.getByText("El paciente no ha compartido evaluaciones con este contexto.")).toBeVisible();

  await evaluated.locator("summary").click();
  await evaluated.getByRole("button",{name:"Consultar permisos clínicos vigentes"}).click();
  const current=evaluated.getByLabel("Permiso clínico");
  await expect(current.locator("option")).toHaveCount(2);
  await current.selectOption({index:1});
  await evaluated.getByLabel("Incluir acceso a la fotografía").check();
  await evaluated.getByRole("button",{name:"Autorizar acceso a esta evaluación"}).click();
  await expect(patient.getByText("Cambios guardados.")).toBeVisible();
  await dentist.getByRole("button",{name:"Ocultar evaluaciones"}).click();
  await dentist.getByRole("button",{name:"Consultar evaluaciones compartidas"}).click();
  await expect(professionalItems).toHaveCount(1);
  console.log("DI-214 navegador real: recarga, comparación, descarga no-store, revocación y nueva concesión.");
} finally {
  await browser.close();
}
