
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "abuse_reports": {
                  Row: {
                    "created_at": string,"details": string | null,"handled_at": string | null,"handled_by": string | null,"id": string,"reason": string,"reporter_id": string | null,"status": string,"target_id": string,"target_type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"details"?: string | null,"handled_at"?: string | null,"handled_by"?: string | null,"id"?: string,"reason": string,"reporter_id"?: string | null,"status"?: string,"target_id": string,"target_type": string
                  }
                  Update: {
                    "created_at"?: string,"details"?: string | null,"handled_at"?: string | null,"handled_by"?: string | null,"id"?: string,"reason"?: string,"reporter_id"?: string | null,"status"?: string,"target_id"?: string,"target_type"?: string
                  }
                  Relationships: [
                    
                  ]
                },"alert_categories": {
                  Row: {
                    "color": string,"icon": string,"id": string,"is_active": boolean,"module": string,"notification_rules": NonNullable<Json>,"priority": number,"sort_order": number,"validation_rules": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "color": string,"icon": string,"id": string,"is_active"?: boolean,"module": string,"notification_rules": NonNullable<Json>,"priority": number,"sort_order"?: number,"validation_rules": NonNullable<Json>
                  }
                  Update: {
                    "color"?: string,"icon"?: string,"id"?: string,"is_active"?: boolean,"module"?: string,"notification_rules"?: NonNullable<Json>,"priority"?: number,"sort_order"?: number,"validation_rules"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"alert_event_updates": {
                  Row: {
                    "author_id": string | null,"created_at": string,"event_id": string,"id": number,"is_public": boolean,"kind": string,"message": string | null,"new_severity": Database["public"]['Enums']["severity_level"] | null,"new_status": Database["public"]['Enums']["verification_status"] | null,"old_severity": Database["public"]['Enums']["severity_level"] | null,"old_status": Database["public"]['Enums']["verification_status"] | null,"reason": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id"?: string | null,"created_at"?: string,"event_id": string,"id"?: never,"is_public"?: boolean,"kind": string,"message"?: string | null,"new_severity"?: Database["public"]['Enums']["severity_level"] | null,"new_status"?: Database["public"]['Enums']["verification_status"] | null,"old_severity"?: Database["public"]['Enums']["severity_level"] | null,"old_status"?: Database["public"]['Enums']["verification_status"] | null,"reason"?: string | null
                  }
                  Update: {
                    "author_id"?: string | null,"created_at"?: string,"event_id"?: string,"id"?: never,"is_public"?: boolean,"kind"?: string,"message"?: string | null,"new_severity"?: Database["public"]['Enums']["severity_level"] | null,"new_status"?: Database["public"]['Enums']["verification_status"] | null,"old_severity"?: Database["public"]['Enums']["severity_level"] | null,"old_status"?: Database["public"]['Enums']["verification_status"] | null,"reason"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "alert_event_updates_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "alert_events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "alert_event_updates_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "event_feed"
      referencedColumns: ["id"]
    }
                  ]
                },"alert_events": {
                  Row: {
                    "category_id": string,"commune_code": string | null,"created_at": string,"created_by": string | null,"depth_km": number | null,"details": NonNullable<Json>,"ended_at": string | null,"external_ref": string | null,"external_source_id": string | null,"external_url": string | null,"id": string,"is_demo": boolean,"is_public": boolean,"last_activity_at": string,"location": unknown,"location_uncertainty_m": number,"magnitude": number | null,"public_note": string | null,"report_count": number,"severity": Database["public"]['Enums']["severity_level"],"source_kind": Database["public"]['Enums']["source_kind"],"started_at": string,"status": Database["public"]['Enums']["verification_status"],"subcategory_id": string,"updated_at": string,"version": number,"wilaya_code": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "category_id": string,"commune_code"?: string | null,"created_at"?: string,"created_by"?: string | null,"depth_km"?: number | null,"details"?: NonNullable<Json>,"ended_at"?: string | null,"external_ref"?: string | null,"external_source_id"?: string | null,"external_url"?: string | null,"id"?: string,"is_demo"?: boolean,"is_public"?: boolean,"last_activity_at"?: string,"location": unknown,"location_uncertainty_m"?: number,"magnitude"?: number | null,"public_note"?: string | null,"report_count"?: number,"severity"?: Database["public"]['Enums']["severity_level"],"source_kind"?: Database["public"]['Enums']["source_kind"],"started_at"?: string,"status"?: Database["public"]['Enums']["verification_status"],"subcategory_id": string,"updated_at"?: string,"version"?: number,"wilaya_code"?: string | null
                  }
                  Update: {
                    "category_id"?: string,"commune_code"?: string | null,"created_at"?: string,"created_by"?: string | null,"depth_km"?: number | null,"details"?: NonNullable<Json>,"ended_at"?: string | null,"external_ref"?: string | null,"external_source_id"?: string | null,"external_url"?: string | null,"id"?: string,"is_demo"?: boolean,"is_public"?: boolean,"last_activity_at"?: string,"location"?: unknown,"location_uncertainty_m"?: number,"magnitude"?: number | null,"public_note"?: string | null,"report_count"?: number,"severity"?: Database["public"]['Enums']["severity_level"],"source_kind"?: Database["public"]['Enums']["source_kind"],"started_at"?: string,"status"?: Database["public"]['Enums']["verification_status"],"subcategory_id"?: string,"updated_at"?: string,"version"?: number,"wilaya_code"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "alert_events_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "alert_categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "alert_events_commune_code_fkey"
      columns: ["commune_code"]
isOneToOne: false
      referencedRelation: "communes"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "alert_events_external_source_id_fkey"
      columns: ["external_source_id"]
isOneToOne: false
      referencedRelation: "alert_sources"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "alert_events_subcategory_id_fkey"
      columns: ["subcategory_id"]
isOneToOne: false
      referencedRelation: "alert_subcategories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "alert_events_wilaya_code_fkey"
      columns: ["wilaya_code"]
isOneToOne: false
      referencedRelation: "wilayas"
      referencedColumns: ["code"]
    }
                  ]
                },"alert_media": {
                  Row: {
                    "created_at": string,"event_id": string | null,"exif_stripped": boolean,"height": number | null,"id": string,"mime_type": string,"moderated_at": string | null,"moderated_by": string | null,"public_path": string | null,"quarantine_path": string,"report_id": string,"sha256": string | null,"size_bytes": number,"status": string,"uploader_id": string | null,"width": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"event_id"?: string | null,"exif_stripped"?: boolean,"height"?: number | null,"id"?: string,"mime_type": string,"moderated_at"?: string | null,"moderated_by"?: string | null,"public_path"?: string | null,"quarantine_path": string,"report_id": string,"sha256"?: string | null,"size_bytes": number,"status"?: string,"uploader_id"?: string | null,"width"?: number | null
                  }
                  Update: {
                    "created_at"?: string,"event_id"?: string | null,"exif_stripped"?: boolean,"height"?: number | null,"id"?: string,"mime_type"?: string,"moderated_at"?: string | null,"moderated_by"?: string | null,"public_path"?: string | null,"quarantine_path"?: string,"report_id"?: string,"sha256"?: string | null,"size_bytes"?: number,"status"?: string,"uploader_id"?: string | null,"width"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "alert_media_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "alert_events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "alert_media_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "event_feed"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "alert_media_report_id_fkey"
      columns: ["report_id"]
isOneToOne: false
      referencedRelation: "alert_reports"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "alert_media_report_id_fkey"
      columns: ["report_id"]
isOneToOne: false
      referencedRelation: "report_feed"
      referencedColumns: ["id"]
    }
                  ]
                },"alert_reports": {
                  Row: {
                    "author_id": string | null,"category_id": string,"client_id": string,"commune_code": string | null,"created_at": string,"description": string,"event_id": string | null,"id": string,"is_demo": boolean,"location": unknown,"location_precision": Database["public"]['Enums']["location_precision"],"location_uncertainty_m": number,"moderated_at": string | null,"moderated_by": string | null,"moderation_status": Database["public"]['Enums']["moderation_status"],"observed_at": string,"rejection_reason": Database["public"]['Enums']["rejection_reason"] | null,"subcategory_id": string,"updated_at": string,"wilaya_code": string | null,"withdrawn_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id"?: string | null,"category_id": string,"client_id": string,"commune_code"?: string | null,"created_at"?: string,"description": string,"event_id"?: string | null,"id"?: string,"is_demo"?: boolean,"location": unknown,"location_precision": Database["public"]['Enums']["location_precision"],"location_uncertainty_m": number,"moderated_at"?: string | null,"moderated_by"?: string | null,"moderation_status"?: Database["public"]['Enums']["moderation_status"],"observed_at": string,"rejection_reason"?: Database["public"]['Enums']["rejection_reason"] | null,"subcategory_id": string,"updated_at"?: string,"wilaya_code"?: string | null,"withdrawn_at"?: string | null
                  }
                  Update: {
                    "author_id"?: string | null,"category_id"?: string,"client_id"?: string,"commune_code"?: string | null,"created_at"?: string,"description"?: string,"event_id"?: string | null,"id"?: string,"is_demo"?: boolean,"location"?: unknown,"location_precision"?: Database["public"]['Enums']["location_precision"],"location_uncertainty_m"?: number,"moderated_at"?: string | null,"moderated_by"?: string | null,"moderation_status"?: Database["public"]['Enums']["moderation_status"],"observed_at"?: string,"rejection_reason"?: Database["public"]['Enums']["rejection_reason"] | null,"subcategory_id"?: string,"updated_at"?: string,"wilaya_code"?: string | null,"withdrawn_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "alert_reports_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "alert_categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "alert_reports_commune_code_fkey"
      columns: ["commune_code"]
isOneToOne: false
      referencedRelation: "communes"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "alert_reports_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "alert_events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "alert_reports_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "event_feed"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "alert_reports_subcategory_id_fkey"
      columns: ["subcategory_id"]
isOneToOne: false
      referencedRelation: "alert_subcategories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "alert_reports_wilaya_code_fkey"
      columns: ["wilaya_code"]
isOneToOne: false
      referencedRelation: "wilayas"
      referencedColumns: ["code"]
    }
                  ]
                },"alert_sources": {
                  Row: {
                    "attribution": string,"circuit_open_until": string | null,"config": NonNullable<Json>,"consecutive_failures": number,"documentation_url": string | null,"enabled": boolean,"homepage_url": string | null,"id": string,"kind": Database["public"]['Enums']["source_kind"],"last_error": string | null,"last_success_at": string | null,"last_sync_at": string | null,"license": string,"name": string,"requires_key": boolean,"sync_interval_minutes": number | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attribution": string,"circuit_open_until"?: string | null,"config"?: NonNullable<Json>,"consecutive_failures"?: number,"documentation_url"?: string | null,"enabled"?: boolean,"homepage_url"?: string | null,"id": string,"kind": Database["public"]['Enums']["source_kind"],"last_error"?: string | null,"last_success_at"?: string | null,"last_sync_at"?: string | null,"license": string,"name": string,"requires_key"?: boolean,"sync_interval_minutes"?: number | null,"updated_at"?: string
                  }
                  Update: {
                    "attribution"?: string,"circuit_open_until"?: string | null,"config"?: NonNullable<Json>,"consecutive_failures"?: number,"documentation_url"?: string | null,"enabled"?: boolean,"homepage_url"?: string | null,"id"?: string,"kind"?: Database["public"]['Enums']["source_kind"],"last_error"?: string | null,"last_success_at"?: string | null,"last_sync_at"?: string | null,"license"?: string,"name"?: string,"requires_key"?: boolean,"sync_interval_minutes"?: number | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"alert_subcategories": {
                  Row: {
                    "category_id": string,"default_severity": Database["public"]['Enums']["severity_level"],"id": string,"is_active": boolean,"reportable": boolean,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "category_id": string,"default_severity": Database["public"]['Enums']["severity_level"],"id": string,"is_active"?: boolean,"reportable": boolean,"sort_order"?: number
                  }
                  Update: {
                    "category_id"?: string,"default_severity"?: Database["public"]['Enums']["severity_level"],"id"?: string,"is_active"?: boolean,"reportable"?: boolean,"sort_order"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "alert_subcategories_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "alert_categories"
      referencedColumns: ["id"]
    }
                  ]
                },"alert_verifications": {
                  Row: {
                    "created_at": string,"event_id": string,"evidence_url": string | null,"external_observation_id": string | null,"id": string,"method": string,"note": string | null,"report_id": string | null,"verdict": string,"verifier_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"event_id": string,"evidence_url"?: string | null,"external_observation_id"?: string | null,"id"?: string,"method": string,"note"?: string | null,"report_id"?: string | null,"verdict": string,"verifier_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"event_id"?: string,"evidence_url"?: string | null,"external_observation_id"?: string | null,"id"?: string,"method"?: string,"note"?: string | null,"report_id"?: string | null,"verdict"?: string,"verifier_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "alert_verifications_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "alert_events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "alert_verifications_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "event_feed"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "alert_verifications_observation_fk"
      columns: ["external_observation_id"]
isOneToOne: false
      referencedRelation: "external_observations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "alert_verifications_report_id_fkey"
      columns: ["report_id"]
isOneToOne: false
      referencedRelation: "alert_reports"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "alert_verifications_report_id_fkey"
      columns: ["report_id"]
isOneToOne: false
      referencedRelation: "report_feed"
      referencedColumns: ["id"]
    }
                  ]
                },"api_sync_runs": {
                  Row: {
                    "duration_ms": number | null,"error": string | null,"events_created": number,"finished_at": string | null,"http_status": number | null,"id": number,"items_fetched": number,"items_upserted": number,"source_id": string,"started_at": string,"status": string,"trigger": string
                  }
                  ComputedFields: never
                  Insert: {
                    "duration_ms"?: number | null,"error"?: string | null,"events_created"?: number,"finished_at"?: string | null,"http_status"?: number | null,"id"?: never,"items_fetched"?: number,"items_upserted"?: number,"source_id": string,"started_at"?: string,"status"?: string,"trigger"?: string
                  }
                  Update: {
                    "duration_ms"?: number | null,"error"?: string | null,"events_created"?: number,"finished_at"?: string | null,"http_status"?: number | null,"id"?: never,"items_fetched"?: number,"items_upserted"?: number,"source_id"?: string,"started_at"?: string,"status"?: string,"trigger"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "api_sync_runs_source_id_fkey"
      columns: ["source_id"]
isOneToOne: false
      referencedRelation: "alert_sources"
      referencedColumns: ["id"]
    }
                  ]
                },"app_settings": {
                  Row: {
                    "description": string | null,"is_public": boolean,"key": string,"updated_at": string,"updated_by": string | null,"value": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "description"?: string | null,"is_public"?: boolean,"key": string,"updated_at"?: string,"updated_by"?: string | null,"value": NonNullable<Json>
                  }
                  Update: {
                    "description"?: string | null,"is_public"?: boolean,"key"?: string,"updated_at"?: string,"updated_by"?: string | null,"value"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"audit_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"actor_roles": (Database["public"]['Enums']["app_role"])[],"created_at": string,"id": number,"metadata": NonNullable<Json>,"target_id": string | null,"target_type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"actor_roles"?: (Database["public"]['Enums']["app_role"])[],"created_at"?: string,"id"?: never,"metadata"?: NonNullable<Json>,"target_id"?: string | null,"target_type": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"actor_roles"?: (Database["public"]['Enums']["app_role"])[],"created_at"?: string,"id"?: never,"metadata"?: NonNullable<Json>,"target_id"?: string | null,"target_type"?: string
                  }
                  Relationships: [
                    
                  ]
                },"communes": {
                  Row: {
                    "boundary": unknown,"centroid": unknown,"code": string,"daira_name_ar": string | null,"daira_name_fr": string | null,"data_source": string,"name_ar": string | null,"name_en": string | null,"name_fr": string,"name_kab": string | null,"osm_id": number | null,"population": number | null,"search_name": string | null,"updated_at": string,"wikidata": string | null,"wilaya_code": string
                  }
                  ComputedFields: never
                  Insert: {
                    "boundary"?: unknown,"centroid": unknown,"code": string,"daira_name_ar"?: string | null,"daira_name_fr"?: string | null,"data_source"?: string,"name_ar"?: string | null,"name_en"?: string | null,"name_fr": string,"name_kab"?: string | null,"osm_id"?: number | null,"population"?: number | null,"search_name"?: never,"updated_at"?: string,"wikidata"?: string | null,"wilaya_code": string
                  }
                  Update: {
                    "boundary"?: unknown,"centroid"?: unknown,"code"?: string,"daira_name_ar"?: string | null,"daira_name_fr"?: string | null,"data_source"?: string,"name_ar"?: string | null,"name_en"?: string | null,"name_fr"?: string,"name_kab"?: string | null,"osm_id"?: number | null,"population"?: number | null,"search_name"?: never,"updated_at"?: string,"wikidata"?: string | null,"wilaya_code"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "communes_wilaya_code_fkey"
      columns: ["wilaya_code"]
isOneToOne: false
      referencedRelation: "wilayas"
      referencedColumns: ["code"]
    }
                  ]
                },"community_assistance": {
                  Row: {
                    "author_id": string | null,"commune_code": string,"created_at": string,"description": string,"expires_at": string,"id": string,"is_demo": boolean,"is_verified_public_aid_point": boolean,"kind": string,"moderated_at": string | null,"moderated_by": string | null,"status": string,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id"?: string | null,"commune_code": string,"created_at"?: string,"description": string,"expires_at": string,"id"?: string,"is_demo"?: boolean,"is_verified_public_aid_point"?: boolean,"kind": string,"moderated_at"?: string | null,"moderated_by"?: string | null,"status"?: string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "author_id"?: string | null,"commune_code"?: string,"created_at"?: string,"description"?: string,"expires_at"?: string,"id"?: string,"is_demo"?: boolean,"is_verified_public_aid_point"?: boolean,"kind"?: string,"moderated_at"?: string | null,"moderated_by"?: string | null,"status"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "community_assistance_commune_code_fkey"
      columns: ["commune_code"]
isOneToOne: false
      referencedRelation: "communes"
      referencedColumns: ["code"]
    }
                  ]
                },"device_push_tokens": {
                  Row: {
                    "created_at": string,"disabled_at": string | null,"enabled": boolean,"failure_count": number,"id": string,"kind": string,"last_error": string | null,"last_seen_at": string,"locale": Database["public"]['Enums']["locale_code"] | null,"platform": string,"token": string,"user_id": string,"web_push_keys": Json | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"disabled_at"?: string | null,"enabled"?: boolean,"failure_count"?: number,"id"?: string,"kind": string,"last_error"?: string | null,"last_seen_at"?: string,"locale"?: Database["public"]['Enums']["locale_code"] | null,"platform": string,"token": string,"user_id": string,"web_push_keys"?: Json | null
                  }
                  Update: {
                    "created_at"?: string,"disabled_at"?: string | null,"enabled"?: boolean,"failure_count"?: number,"id"?: string,"kind"?: string,"last_error"?: string | null,"last_seen_at"?: string,"locale"?: Database["public"]['Enums']["locale_code"] | null,"platform"?: string,"token"?: string,"user_id"?: string,"web_push_keys"?: Json | null
                  }
                  Relationships: [
                    
                  ]
                },"external_observations": {
                  Row: {
                    "confidence": string | null,"depth_km": number | null,"event_id": string | null,"external_id": string,"fetched_at": string,"id": string,"is_demo": boolean,"kind": string,"location": unknown,"magnitude": number | null,"observed_at": string,"payload": NonNullable<Json>,"source_id": string,"title": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "confidence"?: string | null,"depth_km"?: number | null,"event_id"?: string | null,"external_id": string,"fetched_at"?: string,"id"?: string,"is_demo"?: boolean,"kind": string,"location": unknown,"magnitude"?: number | null,"observed_at": string,"payload"?: NonNullable<Json>,"source_id": string,"title"?: string | null
                  }
                  Update: {
                    "confidence"?: string | null,"depth_km"?: number | null,"event_id"?: string | null,"external_id"?: string,"fetched_at"?: string,"id"?: string,"is_demo"?: boolean,"kind"?: string,"location"?: unknown,"magnitude"?: number | null,"observed_at"?: string,"payload"?: NonNullable<Json>,"source_id"?: string,"title"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "external_observations_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "alert_events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "external_observations_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "event_feed"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "external_observations_source_id_fkey"
      columns: ["source_id"]
isOneToOne: false
      referencedRelation: "alert_sources"
      referencedColumns: ["id"]
    }
                  ]
                },"moderation_appeals": {
                  Row: {
                    "appellant_id": string | null,"created_at": string,"decided_at": string | null,"decided_by": string | null,"decision_note": string | null,"id": string,"message": string,"report_id": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "appellant_id"?: string | null,"created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"decision_note"?: string | null,"id"?: string,"message": string,"report_id": string,"status"?: string
                  }
                  Update: {
                    "appellant_id"?: string | null,"created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"decision_note"?: string | null,"id"?: string,"message"?: string,"report_id"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "moderation_appeals_report_id_fkey"
      columns: ["report_id"]
isOneToOne: false
      referencedRelation: "alert_reports"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "moderation_appeals_report_id_fkey"
      columns: ["report_id"]
isOneToOne: false
      referencedRelation: "report_feed"
      referencedColumns: ["id"]
    }
                  ]
                },"notification_deliveries": {
                  Row: {
                    "attempt": number,"channel": string,"created_at": string,"device_token_id": string | null,"error": string | null,"id": string,"notification_id": string,"provider_ticket_id": string | null,"receipt_checked_at": string | null,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempt"?: number,"channel": string,"created_at"?: string,"device_token_id"?: string | null,"error"?: string | null,"id"?: string,"notification_id": string,"provider_ticket_id"?: string | null,"receipt_checked_at"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "attempt"?: number,"channel"?: string,"created_at"?: string,"device_token_id"?: string | null,"error"?: string | null,"id"?: string,"notification_id"?: string,"provider_ticket_id"?: string | null,"receipt_checked_at"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_deliveries_device_token_id_fkey"
      columns: ["device_token_id"]
isOneToOne: false
      referencedRelation: "device_push_tokens"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notification_deliveries_notification_id_fkey"
      columns: ["notification_id"]
isOneToOne: false
      referencedRelation: "user_notifications"
      referencedColumns: ["id"]
    }
                  ]
                },"notification_outbox": {
                  Row: {
                    "attempts": number,"created_at": string,"event_id": string,"event_version": number,"id": number,"last_error": string | null,"processed_at": string | null,"push_count": number | null,"reason": string,"recipients_count": number | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"created_at"?: string,"event_id": string,"event_version": number,"id"?: never,"last_error"?: string | null,"processed_at"?: string | null,"push_count"?: number | null,"reason": string,"recipients_count"?: number | null,"status"?: string
                  }
                  Update: {
                    "attempts"?: number,"created_at"?: string,"event_id"?: string,"event_version"?: number,"id"?: never,"last_error"?: string | null,"processed_at"?: string | null,"push_count"?: number | null,"reason"?: string,"recipients_count"?: number | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_outbox_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "alert_events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notification_outbox_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "event_feed"
      referencedColumns: ["id"]
    }
                  ]
                },"notification_preferences": {
                  Row: {
                    "include_unverified": boolean,"min_severity": Database["public"]['Enums']["severity_level"],"push_enabled": boolean,"quiet_hours_enabled": boolean,"quiet_hours_end": string,"quiet_hours_start": string,"resolution_enabled": boolean,"timezone": string,"updated_at": string,"updates_enabled": boolean,"user_id": string,"web_push_enabled": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "include_unverified"?: boolean,"min_severity"?: Database["public"]['Enums']["severity_level"],"push_enabled"?: boolean,"quiet_hours_enabled"?: boolean,"quiet_hours_end"?: string,"quiet_hours_start"?: string,"resolution_enabled"?: boolean,"timezone"?: string,"updated_at"?: string,"updates_enabled"?: boolean,"user_id": string,"web_push_enabled"?: boolean
                  }
                  Update: {
                    "include_unverified"?: boolean,"min_severity"?: Database["public"]['Enums']["severity_level"],"push_enabled"?: boolean,"quiet_hours_enabled"?: boolean,"quiet_hours_end"?: string,"quiet_hours_start"?: string,"resolution_enabled"?: boolean,"timezone"?: string,"updated_at"?: string,"updates_enabled"?: boolean,"user_id"?: string,"web_push_enabled"?: boolean
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"display_name": string | null,"id": string,"is_suspended": boolean,"preferred_locale": Database["public"]['Enums']["locale_code"],"reputation": number,"suspended_reason": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name"?: string | null,"id": string,"is_suspended"?: boolean,"preferred_locale"?: Database["public"]['Enums']["locale_code"],"reputation"?: number,"suspended_reason"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string | null,"id"?: string,"is_suspended"?: boolean,"preferred_locale"?: Database["public"]['Enums']["locale_code"],"reputation"?: number,"suspended_reason"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"regions": {
                  Row: {
                    "bbox": unknown,"coverage_status": string,"created_at": string,"id": string,"name_ar": string | null,"name_fr": string,"name_kab": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "bbox"?: unknown,"coverage_status"?: string,"created_at"?: string,"id": string,"name_ar"?: string | null,"name_fr": string,"name_kab"?: string | null
                  }
                  Update: {
                    "bbox"?: unknown,"coverage_status"?: string,"created_at"?: string,"id"?: string,"name_ar"?: string | null,"name_fr"?: string,"name_kab"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"report_moderation": {
                  Row: {
                    "action": string,"created_at": string,"event_id": string | null,"id": number,"moderator_id": string | null,"note": string | null,"reason": Database["public"]['Enums']["rejection_reason"] | null,"report_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"created_at"?: string,"event_id"?: string | null,"id"?: never,"moderator_id"?: string | null,"note"?: string | null,"reason"?: Database["public"]['Enums']["rejection_reason"] | null,"report_id": string
                  }
                  Update: {
                    "action"?: string,"created_at"?: string,"event_id"?: string | null,"id"?: never,"moderator_id"?: string | null,"note"?: string | null,"reason"?: Database["public"]['Enums']["rejection_reason"] | null,"report_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "report_moderation_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "alert_events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "report_moderation_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "event_feed"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "report_moderation_report_id_fkey"
      columns: ["report_id"]
isOneToOne: false
      referencedRelation: "alert_reports"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "report_moderation_report_id_fkey"
      columns: ["report_id"]
isOneToOne: false
      referencedRelation: "report_feed"
      referencedColumns: ["id"]
    }
                  ]
                },"user_followed_places": {
                  Row: {
                    "categories": (string)[],"commune_code": string | null,"created_at": string,"id": string,"label": string,"location": unknown,"min_severity": Database["public"]['Enums']["severity_level"] | null,"notify": boolean,"place_type": string,"radius_m": number,"updated_at": string,"user_id": string,"village_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "categories"?: (string)[],"commune_code"?: string | null,"created_at"?: string,"id"?: string,"label": string,"location": unknown,"min_severity"?: Database["public"]['Enums']["severity_level"] | null,"notify"?: boolean,"place_type": string,"radius_m"?: number,"updated_at"?: string,"user_id": string,"village_id"?: string | null
                  }
                  Update: {
                    "categories"?: (string)[],"commune_code"?: string | null,"created_at"?: string,"id"?: string,"label"?: string,"location"?: unknown,"min_severity"?: Database["public"]['Enums']["severity_level"] | null,"notify"?: boolean,"place_type"?: string,"radius_m"?: number,"updated_at"?: string,"user_id"?: string,"village_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_followed_places_commune_code_fkey"
      columns: ["commune_code"]
isOneToOne: false
      referencedRelation: "communes"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "user_followed_places_village_id_fkey"
      columns: ["village_id"]
isOneToOne: false
      referencedRelation: "villages"
      referencedColumns: ["id"]
    }
                  ]
                },"user_notifications": {
                  Row: {
                    "body": string,"channel": string,"created_at": string,"data": NonNullable<Json>,"dedup_key": string,"event_id": string | null,"id": string,"kind": string,"read_at": string | null,"reason": string | null,"severity": Database["public"]['Enums']["severity_level"] | null,"title": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"channel"?: string,"created_at"?: string,"data"?: NonNullable<Json>,"dedup_key": string,"event_id"?: string | null,"id"?: string,"kind": string,"read_at"?: string | null,"reason"?: string | null,"severity"?: Database["public"]['Enums']["severity_level"] | null,"title": string,"user_id": string
                  }
                  Update: {
                    "body"?: string,"channel"?: string,"created_at"?: string,"data"?: NonNullable<Json>,"dedup_key"?: string,"event_id"?: string | null,"id"?: string,"kind"?: string,"read_at"?: string | null,"reason"?: string | null,"severity"?: Database["public"]['Enums']["severity_level"] | null,"title"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_notifications_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "alert_events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_notifications_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "event_feed"
      referencedColumns: ["id"]
    }
                  ]
                },"user_roles": {
                  Row: {
                    "granted_at": string,"granted_by": string | null,"id": number,"organization": string | null,"reason": string | null,"role": Database["public"]['Enums']["app_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "granted_at"?: string,"granted_by"?: string | null,"id"?: never,"organization"?: string | null,"reason"?: string | null,"role": Database["public"]['Enums']["app_role"],"user_id": string
                  }
                  Update: {
                    "granted_at"?: string,"granted_by"?: string | null,"id"?: never,"organization"?: string | null,"reason"?: string | null,"role"?: Database["public"]['Enums']["app_role"],"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"villages": {
                  Row: {
                    "alt_names": (string)[],"commune_code": string | null,"created_at": string,"id": string,"location": unknown,"name_ar": string | null,"name_fr": string,"name_kab": string | null,"proposed_by": string | null,"reviewed_by": string | null,"search_name": string | null,"source": string,"source_ref": string | null,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "alt_names"?: (string)[],"commune_code"?: string | null,"created_at"?: string,"id"?: string,"location": unknown,"name_ar"?: string | null,"name_fr": string,"name_kab"?: string | null,"proposed_by"?: string | null,"reviewed_by"?: string | null,"search_name"?: never,"source": string,"source_ref"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "alt_names"?: (string)[],"commune_code"?: string | null,"created_at"?: string,"id"?: string,"location"?: unknown,"name_ar"?: string | null,"name_fr"?: string,"name_kab"?: string | null,"proposed_by"?: string | null,"reviewed_by"?: string | null,"search_name"?: never,"source"?: string,"source_ref"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "villages_commune_code_fkey"
      columns: ["commune_code"]
isOneToOne: false
      referencedRelation: "communes"
      referencedColumns: ["code"]
    }
                  ]
                },"wilayas": {
                  Row: {
                    "boundary": unknown,"centroid": unknown,"code": string,"data_source": string,"name_ar": string | null,"name_en": string | null,"name_fr": string,"name_kab": string | null,"osm_id": number | null,"region_id": string | null,"updated_at": string,"wikidata": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "boundary"?: unknown,"centroid"?: unknown,"code": string,"data_source"?: string,"name_ar"?: string | null,"name_en"?: string | null,"name_fr": string,"name_kab"?: string | null,"osm_id"?: number | null,"region_id"?: string | null,"updated_at"?: string,"wikidata"?: string | null
                  }
                  Update: {
                    "boundary"?: unknown,"centroid"?: unknown,"code"?: string,"data_source"?: string,"name_ar"?: string | null,"name_en"?: string | null,"name_fr"?: string,"name_kab"?: string | null,"osm_id"?: number | null,"region_id"?: string | null,"updated_at"?: string,"wikidata"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "wilayas_region_id_fkey"
      columns: ["region_id"]
isOneToOne: false
      referencedRelation: "regions"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "event_feed": {
                  Row: {
                    "category_id": string,"commune_code": string | null,"commune_name_ar": string | null,"commune_name_fr": string | null,"created_at": string,"depth_km": number | null,"details": NonNullable<Json>,"ended_at": string | null,"external_source_id": string | null,"external_url": string | null,"id": string,"is_demo": boolean,"is_public": boolean,"last_activity_at": string,"lat": number | null,"lng": number | null,"location_uncertainty_m": number,"magnitude": number | null,"public_note": string | null,"report_count": number,"severity": Database["public"]['Enums']["severity_level"],"source_kind": Database["public"]['Enums']["source_kind"],"started_at": string,"status": Database["public"]['Enums']["verification_status"],"subcategory_id": string,"updated_at": string,"version": number,"wilaya_code": string | null,"wilaya_name_ar": string | null,"wilaya_name_fr": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "alert_events_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "alert_categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "alert_events_commune_code_fkey"
      columns: ["commune_code"]
isOneToOne: false
      referencedRelation: "communes"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "alert_events_external_source_id_fkey"
      columns: ["external_source_id"]
isOneToOne: false
      referencedRelation: "alert_sources"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "alert_events_subcategory_id_fkey"
      columns: ["subcategory_id"]
isOneToOne: false
      referencedRelation: "alert_subcategories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "alert_events_wilaya_code_fkey"
      columns: ["wilaya_code"]
isOneToOne: false
      referencedRelation: "wilayas"
      referencedColumns: ["code"]
    }
                  ]
                },"report_feed": {
                  Row: {
                    "author_id": string | null,"category_id": string,"commune_code": string | null,"commune_name_fr": string | null,"created_at": string,"description": string,"event_id": string | null,"id": string,"lat": number | null,"lng": number | null,"location_precision": Database["public"]['Enums']["location_precision"],"location_uncertainty_m": number,"moderated_at": string | null,"moderation_status": Database["public"]['Enums']["moderation_status"],"observed_at": string,"rejection_reason": Database["public"]['Enums']["rejection_reason"] | null,"subcategory_id": string,"wilaya_code": string | null,"withdrawn_at": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "alert_reports_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "alert_categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "alert_reports_commune_code_fkey"
      columns: ["commune_code"]
isOneToOne: false
      referencedRelation: "communes"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "alert_reports_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "alert_events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "alert_reports_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "event_feed"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "alert_reports_subcategory_id_fkey"
      columns: ["subcategory_id"]
isOneToOne: false
      referencedRelation: "alert_subcategories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "alert_reports_wilaya_code_fkey"
      columns: ["wilaya_code"]
isOneToOne: false
      referencedRelation: "wilayas"
      referencedColumns: ["code"]
    }
                  ]
                }
          }
          Functions: {
            "add_event_verification":
{ Args: { "p_event_id": string,"p_evidence_url"?: string,"p_note"?: string,"p_verdict": string }; Returns: string
                           },
"admin_dashboard_stats":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"admin_find_users":
{ Args: { "p_limit"?: number,"p_query": string }; Returns: {
              "created_at": string,"display_name": string,"email": string,"id": string,"is_suspended": boolean,"last_sign_in_at": string,"reports_count": number,"reputation": number,"roles": (Database["public"]['Enums']["app_role"])[]
            }[]
                           },
"admin_set_role":
{ Args: { "p_grant": boolean,"p_organization"?: string,"p_reason": string,"p_role": Database["public"]['Enums']["app_role"],"p_user_id": string }; Returns: undefined
                           },
"admin_set_suspension":
{ Args: { "p_reason": string,"p_suspended": boolean,"p_user_id": string }; Returns: undefined
                           },
"admin_update_setting":
{ Args: { "p_key": string,"p_value": Json }; Returns: undefined
                           },
"close_my_assistance_post":
{ Args: { "p_id": string }; Returns: undefined
                           },
"commune_boundaries_geojson":
{ Args: { "p_wilaya_codes"?: (string)[] }; Returns: Json
                           },
"commune_points":
{ Args: { "p_limit"?: number }; Returns: {
              "code": string,"lat": number,"lng": number,"name_fr": string,"population": number,"wilaya_code": string
            }[]
                           },
"create_abuse_report":
{ Args: { "p_details"?: string,"p_reason": string,"p_target_id": string,"p_target_type": string }; Returns: undefined
                           },
"create_appeal":
{ Args: { "p_message": string,"p_report_id": string }; Returns: string
                           },
"create_assistance_post":
{ Args: { "p_commune_code": string,"p_description": string,"p_expires_in_days": number,"p_kind": string,"p_title": string }; Returns: string
                           },
"decide_appeal":
{ Args: { "p_accept": boolean,"p_appeal_id": string,"p_note"?: string }; Returns: undefined
                           },
"events_in_bbox":
{ Args: { "p_categories"?: (string)[],"p_east": number,"p_limit"?: number,"p_north": number,"p_since"?: string,"p_south": number,"p_statuses"?: (Database["public"]['Enums']["verification_status"])[],"p_west": number }; Returns: {
              "category_id": string,
"commune_code": string | null,
"commune_name_ar": string | null,
"commune_name_fr": string | null,
"created_at": string,
"depth_km": number | null,
"details": NonNullable<Json>,
"ended_at": string | null,
"external_source_id": string | null,
"external_url": string | null,
"id": string,
"is_demo": boolean,
"is_public": boolean,
"last_activity_at": string,
"lat": number | null,
"lng": number | null,
"location_uncertainty_m": number,
"magnitude": number | null,
"public_note": string | null,
"report_count": number,
"severity": Database["public"]['Enums']["severity_level"],
"source_kind": Database["public"]['Enums']["source_kind"],
"started_at": string,
"status": Database["public"]['Enums']["verification_status"],
"subcategory_id": string,
"updated_at": string,
"version": number,
"wilaya_code": string | null,
"wilaya_name_ar": string | null,
"wilaya_name_fr": string | null
            }[]
                          SetofOptions: {
        from: "*"
        to: "event_feed"
        isOneToOne: false
        isSetofReturn: true
      } },
"events_near":
{ Args: { "p_active_only"?: boolean,"p_categories"?: (string)[],"p_lat": number,"p_limit"?: number,"p_lng": number,"p_radius_m": number }; Returns: {
              "category_id": string,
"commune_code": string | null,
"commune_name_ar": string | null,
"commune_name_fr": string | null,
"created_at": string,
"depth_km": number | null,
"details": NonNullable<Json>,
"ended_at": string | null,
"external_source_id": string | null,
"external_url": string | null,
"id": string,
"is_demo": boolean,
"is_public": boolean,
"last_activity_at": string,
"lat": number | null,
"lng": number | null,
"location_uncertainty_m": number,
"magnitude": number | null,
"public_note": string | null,
"report_count": number,
"severity": Database["public"]['Enums']["severity_level"],
"source_kind": Database["public"]['Enums']["source_kind"],
"started_at": string,
"status": Database["public"]['Enums']["verification_status"],
"subcategory_id": string,
"updated_at": string,
"version": number,
"wilaya_code": string | null,
"wilaya_name_ar": string | null,
"wilaya_name_fr": string | null
            }[]
                          SetofOptions: {
        from: "*"
        to: "event_feed"
        isOneToOne: false
        isSetofReturn: true
      } },
"export_my_data":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"handle_abuse_report":
{ Args: { "p_id": string,"p_status": string }; Returns: undefined
                           },
"increment_token_failure":
{ Args: { "p_error": string,"p_token_id": string }; Returns: undefined
                           },
"mark_notifications_read":
{ Args: { "p_ids"?: (string)[] }; Returns: number
                           },
"moderate_approve_report":
{ Args: { "p_event_id": string,"p_mode": string,"p_public_note"?: string,"p_report_id": string,"p_severity": Database["public"]['Enums']["severity_level"],"p_status": Database["public"]['Enums']["verification_status"] }; Returns: string
                           },
"moderate_assistance_post":
{ Args: { "p_id": string,"p_status": string,"p_verified_aid_point"?: boolean }; Returns: undefined
                           },
"moderate_reject_report":
{ Args: { "p_note"?: string,"p_reason": Database["public"]['Enums']["rejection_reason"],"p_report_id": string }; Returns: undefined
                           },
"moderate_set_event_visibility":
{ Args: { "p_event_id": string,"p_is_public": boolean,"p_reason": string }; Returns: undefined
                           },
"moderate_update_event":
{ Args: { "p_event_id": string,"p_public_note"?: string,"p_reason"?: string,"p_severity"?: Database["public"]['Enums']["severity_level"],"p_status"?: Database["public"]['Enums']["verification_status"] }; Returns: undefined
                           },
"my_followed_places_summary":
{ Args: Record<PropertyKey, never>; Returns: {
              "active_events": number,"categories": (string)[],"commune_code": string,"commune_name_ar": string,"commune_name_fr": string,"created_at": string,"id": string,"label": string,"last_event_at": string,"lat": number,"lng": number,"min_severity": Database["public"]['Enums']["severity_level"],"notify": boolean,"place_type": string,"radius_m": number,"wilaya_code": string,"wilaya_name_ar": string,"wilaya_name_fr": string
            }[]
                           },
"notification_candidates":
{ Args: { "p_event_id": string }; Returns: {
              "distance_m": number,"followed_place_id": string,"include_unverified": boolean,"locale": Database["public"]['Enums']["locale_code"],"min_severity": Database["public"]['Enums']["severity_level"],"place_categories": (string)[],"place_label": string,"place_min_severity": Database["public"]['Enums']["severity_level"],"place_notify": boolean,"push_enabled": boolean,"quiet_hours_enabled": boolean,"quiet_hours_end": string,"quiet_hours_start": string,"resolution_enabled": boolean,"timezone": string,"updates_enabled": boolean,"user_id": string,"web_push_enabled": boolean
            }[]
                           },
"observations_in_bbox":
{ Args: { "p_east": number,"p_kinds"?: (string)[],"p_limit"?: number,"p_north": number,"p_since"?: string,"p_south": number,"p_west": number }; Returns: {
              "confidence": string,"depth_km": number,"event_id": string,"id": string,"is_demo": boolean,"kind": string,"lat": number,"lng": number,"magnitude": number,"observed_at": string,"payload": Json,"source_id": string,"title": string
            }[]
                           },
"propose_village":
{ Args: { "p_lat": number,"p_lng": number,"p_name": string }; Returns: string
                           },
"register_push_token":
{ Args: { "p_kind": string,"p_locale"?: Database["public"]['Enums']["locale_code"],"p_platform": string,"p_token": string,"p_web_push_keys"?: Json }; Returns: string
                           },
"register_report_media":
{ Args: { "p_path": string,"p_report_id": string }; Returns: string
                           },
"review_village":
{ Args: { "p_approve": boolean,"p_village_id": string }; Returns: undefined
                           },
"search_places":
{ Args: { "max_results"?: number,"q": string }; Returns: {
              "commune_code": string,"commune_name_fr": string,"id": string,"kind": string,"lat": number,"lng": number,"name_ar": string,"name_fr": string,"score": number,"wilaya_code": string,"wilaya_name_fr": string
            }[]
                           },
"service_log_audit":
{ Args: { "p_action": string,"p_actor_id": string,"p_metadata"?: Json,"p_target_id": string,"p_target_type": string }; Returns: undefined
                           },
"submit_report":
{ Args: { "p_category_id": string,"p_client_id": string,"p_description": string,"p_lat": number,"p_lng": number,"p_location_precision": Database["public"]['Enums']["location_precision"],"p_location_uncertainty_m": number,"p_observed_at": string,"p_subcategory_id": string }; Returns: Json
                           },
"unregister_push_token":
{ Args: { "p_token": string }; Returns: undefined
                           },
"update_report_description":
{ Args: { "p_description": string,"p_report_id": string }; Returns: undefined
                           },
"withdraw_report":
{ Args: { "p_report_id": string }; Returns: undefined
                           }
          }
          Enums: {
            "app_role": "trusted_contributor"|"moderator"|"admin"|"partner","locale_code": "fr"|"kab"|"ar","location_precision": "exact"|"approximate"|"uncertain","moderation_status": "pending"|"approved"|"merged"|"rejected"|"withdrawn","rejection_reason": "insufficient_information"|"outside_coverage"|"duplicate"|"false_or_misleading"|"abusive_content"|"personal_data"|"not_an_alert"|"other","severity_level": "information"|"vigilance"|"important"|"critical","source_kind": "community"|"official"|"seismic"|"satellite"|"forecast","verification_status": "received"|"under_review"|"corroborated"|"confirmed"|"rejected"|"resolved"|"archived"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "app_role": ["trusted_contributor", "moderator", "admin", "partner"],"locale_code": ["fr", "kab", "ar"],"location_precision": ["exact", "approximate", "uncertain"],"moderation_status": ["pending", "approved", "merged", "rejected", "withdrawn"],"rejection_reason": ["insufficient_information", "outside_coverage", "duplicate", "false_or_misleading", "abusive_content", "personal_data", "not_an_alert", "other"],"severity_level": ["information", "vigilance", "important", "critical"],"source_kind": ["community", "official", "seismic", "satellite", "forecast"],"verification_status": ["received", "under_review", "corroborated", "confirmed", "rejected", "resolved", "archived"]
          }
        }
} as const
