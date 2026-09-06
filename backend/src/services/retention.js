/** Ya no se borran cédulas solas: el admin tiene que autorizar el borrado de versiones viejas. */
export function purgeExpiredIdDocuments() {
  return 0;
}

export function scheduleIdPurge(_paseadorId) {
  /* los archivos vigentes se conservan hasta que el admin autorice borrar una versión reemplazada */
}
