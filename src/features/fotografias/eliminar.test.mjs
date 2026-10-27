import test from 'node:test';
import assert from 'node:assert/strict';
import { eliminarFotografia, ErrorEliminacionFoto } from './eliminar.ts';

const usuario = '11111111-1111-4111-8111-111111111111';
const consentimiento = '22222222-2222-4222-8222-222222222222';
const archivo = '33333333-3333-4333-8333-333333333333.png';
const fotoId = '44444444-4444-4444-8444-444444444444';
const ruta = `${usuario}/${consentimiento}/${archivo}`;

// Modelo con estado de dos servicios separados: nunca usa red, JWT o credenciales reales.
function cliente(opciones = {}) {
  const estado = {
    archivo: opciones.archivo ?? true,
    foto: opciones.foto === null ? null : { id: fotoId, user_id: usuario, consent_id: consentimiento,
      object_path: ruta, bucket_id: 'dental-photos', ...opciones.foto },
    fallosBD: opciones.fallosBD ?? 0, llamadas: [], sesiones: 0,
  };
  const client = {
    auth: { async getUser() {
      estado.llamadas.push(['auth']);
      estado.sesiones++;
      const id = opciones.sinSesion || (opciones.expira && estado.sesiones >= 3) ? null : (opciones.usuario ?? usuario);
      return { data: { user: id ? { id } : null }, error: opciones.errorAuth ?? null };
    } },
    from(tabla) {
      assert.equal(tabla, 'dental_photos');
      let borrar = false;
      const filtros = {};
      return {
        select() { return this; },
        delete() { borrar = true; return this; },
        eq(campo, valor) { filtros[campo] = valor; return this; },
        async maybeSingle() {
          estado.llamadas.push([borrar ? 'deleteBD' : 'leerBD', { ...filtros }]);
          if (opciones.errorLectura && !borrar) return { data: null, error: opciones.errorLectura };
          const coincide = estado.foto && Object.entries(filtros).every(([k, v]) => estado.foto[k] === v);
          if (!borrar) return { data: coincide ? { ...estado.foto } : null, error: null };
          if (estado.fallosBD > 0) {
            estado.fallosBD--;
            return { data: null, error: opciones.errorBD ?? { code: '57014' } };
          }
          if (opciones.deleteSinFilas) return { data: null, error: null };
          if (opciones.concurrente) estado.foto = null;
          if (!coincide || opciones.concurrente) return { data: null, error: null };
          estado.foto = null;
          return { data: { id: fotoId }, error: null };
        },
      };
    },
    storage: { from(bucket) {
      assert.equal(bucket, 'dental-photos');
      return {
        async remove(paths) {
          estado.llamadas.push(['remove', paths]);
          assert.deepEqual(paths, [ruta]);
          if (opciones.excepcionStorage) throw new Error('network failed');
          if (opciones.errorStorage) return { data: null, error: opciones.errorStorage };
          const existia = estado.archivo;
          if (!opciones.removeSinEfecto) estado.archivo = false;
          return { data: existia && !opciones.removeSinEfecto ? [{ name: ruta }] : [], error: null };
        },
        async list(folder, options) {
          estado.llamadas.push(['list', folder, options]);
          assert.equal(folder, `${usuario}/${consentimiento}`);
          assert.equal(options.search, archivo);
          if (opciones.errorLista) return { data: null, error: opciones.errorLista };
          return { data: estado.archivo ? [{ name: archivo }] : [], error: null };
        },
        // Una regresión al algoritmo anterior falla incluso si el consentimiento está vigente.
        async download() { assert.fail('El borrado no debe descargar ni restaurar imágenes'); },
        async upload() { assert.fail('La recuperación no debe necesitar INSERT ni consentimiento vigente'); },
      };
    } },
  };
  return { client, estado };
}

const eliminar = (c) => eliminarFotografia(c.client, usuario, fotoId);
const falla = (tipo, parcial = false) => (e) => e instanceof ErrorEliminacionFoto && e.tipo === tipo && e.archivoAusente === parcial;

test('elimina el archivo y luego los metadatos filtrando propietario, ID y ruta', async () => {
  const c = cliente();
  assert.equal(await eliminar(c), 'eliminada');
  assert.equal(c.estado.archivo, false);
  assert.equal(c.estado.foto, null);
  const llamadas = c.estado.llamadas;
  assert(llamadas.findIndex(x => x[0] === 'remove') < llamadas.findIndex(x => x[0] === 'deleteBD'));
  assert.deepEqual(llamadas.find(x => x[0] === 'deleteBD')[1], {id:fotoId,user_id:usuario,object_path:ruta});
});

test('archivo inexistente: remove devuelve [] y completa la limpieza de metadatos', async () => {
  const c = cliente({ archivo: false });
  assert.equal(await eliminar(c), 'eliminada');
  assert.equal(c.estado.foto, null);
});

test('fallo de Storage conserva ambos recursos y no intenta DELETE de PostgreSQL', async () => {
  const c = cliente({ errorStorage: { status: 500 } });
  await assert.rejects(() => eliminar(c), falla('storage'));
  assert(c.estado.archivo && c.estado.foto);
  assert(!c.estado.llamadas.some(x => x[0] === 'deleteBD'));
});

test('excepción de red se traduce sin presentar éxito ni borrar metadatos', async () => {
  const c = cliente({ excepcionStorage: true });
  await assert.rejects(() => eliminar(c), falla('storage'));
  assert(c.estado.archivo && c.estado.foto);
});

test('fallo de PostgreSQL tras borrar archivo conserva el registro y explica el reintento', async () => {
  const c = cliente({ fallosBD: 1 });
  await assert.rejects(() => eliminar(c), e => falla('base_datos', true)(e) && /reintentar/i.test(e.message));
  assert.equal(c.estado.archivo, false);
  assert(c.estado.foto);
});

test('reintento después de fallo parcial completa la limpieza sin re-subir; repetir es inocuo', async () => {
  const c = cliente({ fallosBD: 1 });
  await assert.rejects(() => eliminar(c), falla('base_datos', true));
  assert.equal(await eliminar(c), 'eliminada');
  const mutaciones = c.estado.llamadas.filter(x => ['remove','deleteBD'].includes(x[0])).length;
  assert.equal(await eliminar(c), 'no_disponible');
  assert.equal(c.estado.llamadas.filter(x => ['remove','deleteBD'].includes(x[0])).length, mutaciones);
  assert.equal(c.estado.foto, null);
});

test('consentimiento revocado: la eliminación y recuperación no requieren consultarlo ni upload', async () => {
  // El mock solo permite SELECT/DELETE propios. INSERT/UPLOAD siempre fallan.
  const c = cliente({ fallosBD: 1, archivo: true });
  await assert.rejects(() => eliminar(c));
  assert.equal(await eliminar(c), 'eliminada');
  assert.equal(c.estado.archivo, false);
  assert.equal(c.estado.foto, null);
});

test('foto de otro propietario es invisible y no se toca Storage ni se informa borrado', async () => {
  const c = cliente({ foto: { user_id: 'otro' } });
  assert.equal(await eliminar(c), 'no_disponible');
  assert(c.estado.archivo && c.estado.foto);
  assert(!c.estado.llamadas.some(x => ['remove','deleteBD'].includes(x[0])));
});

test('rechaza rutas ajenas, bucket distinto y rutas manipuladas aunque haya metadatos propios', async () => {
  for (const foto of [{object_path:`otro/${consentimiento}/${archivo}`},{bucket_id:'otro'},
    {object_path:`${usuario}/${consentimiento}/../ajeno.png`},{object_path:`${usuario}/${consentimiento}/%2e%2e.png`}]) {
    const c = cliente({ foto });
    await assert.rejects(() => eliminar(c), falla('permisos'));
    assert(!c.estado.llamadas.some(x => ['remove','deleteBD'].includes(x[0])));
  }
});

test('sin sesión, JWT inválido o cambio de usuario no se consulta ni modifica ningún recurso', async () => {
  for (const options of [{sinSesion:true},{errorAuth:{status:401,code:'bad_jwt'}},{usuario:'otro'}]) {
    const c = cliente(options);
    await assert.rejects(() => eliminar(c), falla('sesion'));
    assert(c.estado.llamadas.every(x => x[0] === 'auth'));
  }
});

test('sesión expirada entre servicios conserva los metadatos y permite reintentar al autenticarse', async () => {
  const c = cliente({ expira: true });
  await assert.rejects(() => eliminar(c), falla('sesion', true));
  assert.equal(c.estado.archivo, false);
  assert(c.estado.foto);
  assert(!c.estado.llamadas.some(x => x[0] === 'deleteBD'));
});

test('Storage 200 sin filas afectadas no es éxito si el objeto sigue listado', async () => {
  const c = cliente({ removeSinEfecto: true });
  await assert.rejects(() => eliminar(c), falla('storage'));
  assert(c.estado.archivo && c.estado.foto);
  assert(!c.estado.llamadas.some(x => x[0] === 'deleteBD'));
});

test('fallo al comprobar Storage impide borrar el registro', async () => {
  const c = cliente({ errorLista: { status: 403 } });
  await assert.rejects(() => eliminar(c), falla('permisos'));
  assert(c.estado.foto);
  assert(!c.estado.llamadas.some(x => x[0] === 'deleteBD'));
});

test('DELETE de PostgreSQL sin filas y con registro aún presente no informa éxito', async () => {
  const c = cliente({ deleteSinFilas: true });
  await assert.rejects(() => eliminar(c), falla('permisos', true));
  assert(c.estado.foto);
});

test('borrado concurrente de metadatos se comprueba antes de confirmar finalización', async () => {
  const c = cliente({ concurrente: true });
  assert.equal(await eliminar(c), 'eliminada');
  assert.equal(c.estado.foto, null);
  assert.equal(c.estado.llamadas.filter(x => x[0] === 'leerBD').length, 2);
});

test('distingue errores de permisos y base de datos sin filtrar mensajes del proveedor', async () => {
  for (const [errorLectura,tipo] of [[{code:'42501',message:'detalle privado'},'permisos'],[{code:'57014'},'base_datos']]) {
    const c = cliente({ errorLectura });
    await assert.rejects(() => eliminar(c), e => falla(tipo)(e) && !e.message.includes('detalle privado'));
    assert(!c.estado.llamadas.some(x => x[0] === 'remove'));
  }
});
