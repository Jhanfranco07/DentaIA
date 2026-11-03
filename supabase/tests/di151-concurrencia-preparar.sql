-- Solo fixture desechable; estado independiente de la prueba anterior (ROLLBACK).
insert into auth.users(id,raw_app_meta_data) values
  (public.qa_id(1),'{"dentaia":{"version":1,"estado":"activo","roles":["superusuario"]}}'),
  (public.qa_id(2),'{"dentaia":{"version":1,"estado":"activo","roles":["superusuario"]}}'),
  (public.qa_id(3),'{"provider":"email"}'),(public.qa_id(4),'{"provider":"email"}'),
  (public.qa_id(5),'{"dentaia":{"version":1,"estado":"activo","roles":["superusuario"]}}');
insert into auth.mfa_factors values(public.qa_id(10),public.qa_id(1),'verified','totp');
insert into auth.sessions values(public.qa_id(11),public.qa_id(1),public.qa_id(10),'aal2',now()+interval '1 hour');
insert into auth.mfa_amr_claims values(public.qa_id(11),'totp',clock_timestamp());
insert into dentaia_admin.aprobaciones_roles(id,actor_id,objetivo_id,aprobado_por,operacion,rol,revision_esperada,vence_en)
values(public.qa_id(20),public.qa_id(1),public.qa_id(3),public.qa_id(2),'asignar','paciente',0,now()+interval '1 hour'),
      (public.qa_id(21),public.qa_id(1),public.qa_id(3),public.qa_id(2),'asignar','paciente',0,now()+interval '1 hour'),
      (public.qa_id(22),public.qa_id(1),public.qa_id(4),public.qa_id(2),'asignar','paciente',0,now()+interval '1 hour');
insert into auth.mfa_factors values(public.qa_id(14),public.qa_id(2),'verified','totp');
insert into auth.sessions values(public.qa_id(12),public.qa_id(2),public.qa_id(14),'aal2',now()+interval '1 hour');
insert into auth.mfa_amr_claims values(public.qa_id(12),'totp',clock_timestamp());
insert into dentaia_admin.aprobaciones_roles(id,actor_id,objetivo_id,aprobado_por,operacion,rol,revision_esperada,asignacion_esperada,vence_en)
values(public.qa_id(23),public.qa_id(1),public.qa_id(2),public.qa_id(5),'revocar','superusuario',0,
  '{"version":1,"estado":"activo","roles":["superusuario"]}',now()+interval '1 hour'),
  (public.qa_id(24),public.qa_id(2),public.qa_id(1),public.qa_id(5),'revocar','superusuario',0,
  '{"version":1,"estado":"activo","roles":["superusuario"]}',now()+interval '1 hour');
