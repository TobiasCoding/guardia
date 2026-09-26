# GUARDIA — El deploy del viernes

Resultado: Resuelto
Puntaje: 866/1000
Tiempo simulado: 00:28
Equipo: Alex

## Causa raíz
La versión v2.14 activó recommendations_v2: una consulta por cada producto (N+1) agotó el pool de conexiones de Postgres. No era falta de réplicas.

## Aprendizaje
Correlacioná el inicio del incidente con los cambios recientes. Una mitigación reversible puede restablecer el servicio antes de corregir el código.

## Prevención
- Agregar pruebas de carga para la ruta de checkout.
- Limitar las consultas por request y observar la saturación del pool.
- Activar funciones gradualmente, con apagado reversible.

## Cronología
- +00:00 Sala creada. El equipo puede sumarse antes de comenzar.
- +00:00 Alerta SEV-1: checkout degradado. Se inicia la guardia.
- +00:05 [Alex] Leer logs de Checkout
- +00:05 [Alex] La API espera conexiones. El aumento coincide con v2.14 y una función nueva.
- +00:10 [Alex] Comparar último deploy
- +00:10 [Alex] La función puede apagarse sin tocar datos. También existe un rollback sin migraciones.
- +00:10 [Alex] \<img src=x onerror=alert(1)\> Hipótesis
- +00:21 [Alex] Apagar recommendations\_v2
- +00:21 [Alex] Función deshabilitada. El pool se libera y el checkout vuelve a responder.
- +00:23 [Alex] Comunicar estado del incidente
- +00:23 [Alex] Estado compartido: detectamos una degradación y estamos investigando. Habrá una actualización al recuperar el servicio.
- +00:28 [Alex] Verificar recuperación
- +00:28 Pruebas sintéticas OK. El checkout está recuperado. Incidente cerrado.

## Puntaje
time: 227
budget: 289
diagnosis: 100
communication: 100
recovery: 150
penalty: 0

Simulación educativa con datos sintéticos. El puntaje no certifica competencias profesionales.
