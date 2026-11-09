// SPDX-License-Identifier: MIT
// Starfall's binding to Box3D (https://github.com/erincatto/box3d): a flat C API of numbers and handles
// that JavaScript can call without marshalling structs. src/engine/physics.js wraps it. build.sh compiles
// this file with Box3D into box3d.js + box3d.wasm.
//
// Box3D has one gravity vector per world; a planet pulls toward its center, so the world has no gravity and
// sf_step pushes every dynamic body toward the origin before each step.
//
// The character mover is Box3D's dynamic mover (samples/dynamic_mover.cpp) cut down and turned so that "up"
// points away from the planet's center: a rotation-locked body driven by a mover joint (horizontal speed)
// and held off the ground by a pogo joint (a spring along a ray cast down).
#include "box3d/box3d.h"
#include "box3d/math_functions.h"

#include <emscripten/emscripten.h>
#include <math.h>
#include <stdlib.h>

#define EXPORT EMSCRIPTEN_KEEPALIVE
#define MAX_BODIES 2048
#define MAX_SHAPES 4096
#define MAX_CHUNKS 256

static b3WorldId world;
static float gravity = 9.8f;

// Results come back through this scratch buffer; JS reads it as a Float32Array.
static float scratch[32];
EXPORT float* sf_scratch( void ) { return scratch; }

// ---------- handles ----------
// JS holds small integers; these tables map them to Box3D ids. Slot 0 is never used.
static b3BodyId bodies[MAX_BODIES];
static float gravityScale[MAX_BODIES];
static int bodyTop = 1, freeBodies[MAX_BODIES], freeBodyCount = 0;
static b3ShapeId shapes[MAX_SHAPES];
static int shapeTop = 1, freeShapes[MAX_SHAPES], freeShapeCount = 0;

static int newBodySlot( void )
{
	if ( freeBodyCount > 0 ) return freeBodies[--freeBodyCount];
	return bodyTop < MAX_BODIES ? bodyTop++ : 0;
}

static int newShapeSlot( b3ShapeId id )
{
	int s = freeShapeCount > 0 ? freeShapes[--freeShapeCount] : ( shapeTop < MAX_SHAPES ? shapeTop++ : 0 );
	if ( s ) shapes[s] = id;
	return s;
}

static b3Vec3 v3( float x, float y, float z ) { return (b3Vec3){ x, y, z }; }

// The rotation that turns +Y into the unit vector up.
static b3Quat quatFromUp( b3Vec3 up )
{
	float d = up.y;
	if ( d < -0.9999f ) return (b3Quat){ { 1.0f, 0.0f, 0.0f }, 0.0f };
	b3Vec3 axis = { up.z, 0.0f, -up.x }; // cross(Y, up)
	b3Quat q = { axis, 1.0f + d };
	return b3NormalizeQuat( q );
}

// ---------- world ----------
EXPORT void sf_init( float g )
{
	gravity = g;
	b3WorldDef def = b3DefaultWorldDef();
	def.gravity = b3Vec3_zero;
	def.workerCount = 1;
	world = b3CreateWorld( &def );
}

EXPORT void sf_set_gravity( float g ) { gravity = g; }

EXPORT void sf_step( float dt, int subSteps )
{
	if ( dt <= 0.0f ) return;
	for ( int i = 1; i < bodyTop; ++i )
	{
		if ( gravityScale[i] == 0.0f || b3Body_IsValid( bodies[i] ) == false || b3Body_IsAwake( bodies[i] ) == false ) continue;
		b3Pos p = b3Body_GetPosition( bodies[i] );
		float len = sqrtf( p.x * p.x + p.y * p.y + p.z * p.z );
		if ( len < 1e-3f ) continue;
		float f = -gravity * gravityScale[i] * b3Body_GetMass( bodies[i] ) / len;
		b3Body_ApplyForceToCenter( bodies[i], v3( f * p.x, f * p.y, f * p.z ), false );
	}
	b3World_Step( world, dt, subSteps );
}

// ---------- bodies ----------
// type: 0 static, 1 kinematic, 2 dynamic. flags: 1 lock rotation, 2 bullet, 4 never sleep.
EXPORT int sf_body( int type, float x, float y, float z, float gScale, float linearDamping, float angularDamping, int flags )
{
	int h = newBodySlot();
	if ( h == 0 ) return 0;
	b3BodyDef def = b3DefaultBodyDef();
	def.type = (b3BodyType)type;
	def.position = v3( x, y, z );
	def.gravityScale = 0.0f;
	def.linearDamping = linearDamping;
	def.angularDamping = angularDamping;
	def.motionLocks.angularX = def.motionLocks.angularY = def.motionLocks.angularZ = ( flags & 1 ) != 0;
	def.isBullet = ( flags & 2 ) != 0;
	def.enableSleep = ( flags & 4 ) == 0;
	bodies[h] = b3CreateBody( world, &def );
	gravityScale[h] = type == 2 ? gScale : 0.0f;
	return h;
}

EXPORT void sf_destroy( int h )
{
	if ( h <= 0 || b3Body_IsValid( bodies[h] ) == false ) return;
	b3DestroyBody( bodies[h] );
	gravityScale[h] = 0.0f;
	freeBodies[freeBodyCount++] = h;
}

static b3ShapeDef shapeDef( float density, float friction, float restitution, float rolling, unsigned cat, unsigned mask )
{
	b3ShapeDef def = b3DefaultShapeDef();
	def.density = density;
	def.baseMaterial.friction = friction;
	def.baseMaterial.restitution = restitution;
	def.baseMaterial.rollingResistance = rolling;
	def.filter.categoryBits = cat;
	def.filter.maskBits = mask;
	return def;
}

EXPORT int sf_sphere( int h, float cx, float cy, float cz, float r, float density, float friction, float restitution, float rolling, unsigned cat, unsigned mask )
{
	b3ShapeDef def = shapeDef( density, friction, restitution, rolling, cat, mask );
	b3Sphere s = { v3( cx, cy, cz ), r };
	return newShapeSlot( b3CreateSphereShape( bodies[h], &def, &s ) );
}

EXPORT int sf_capsule( int h, float x1, float y1, float z1, float x2, float y2, float z2, float r, float density, float friction, float restitution, unsigned cat, unsigned mask )
{
	b3ShapeDef def = shapeDef( density, friction, restitution, 0.0f, cat, mask );
	b3Capsule c = { v3( x1, y1, z1 ), v3( x2, y2, z2 ), r };
	return newShapeSlot( b3CreateCapsuleShape( bodies[h], &def, &c ) );
}

// A convex hull of count points (xyz floats at pts). Returns an opaque hull handle for sf_hull.
EXPORT b3HullData* sf_make_hull( const float* pts, int count )
{
	return b3CreateHull( (const b3Vec3*)pts, count, 64 );
}

// An upright cylinder hull standing on y = 0.
EXPORT b3HullData* sf_make_cylinder( float height, float radius, int sides )
{
	return b3CreateCylinder( height, radius, 0.0f, sides );
}

// Attach a hull, scaled by s (the world keeps its own copy, shared between equal hulls).
EXPORT int sf_hull( int h, const b3HullData* hull, float s, float density, float friction, float restitution, unsigned cat, unsigned mask )
{
	b3ShapeDef def = shapeDef( density, friction, restitution, 0.0f, cat, mask );
	if ( s == 1.0f ) return newShapeSlot( b3CreateHullShape( bodies[h], &def, hull ) );
	return newShapeSlot( b3CreateTransformedHullShape( bodies[h], &def, hull, b3Transform_identity, v3( s, s, s ) ) );
}

EXPORT void sf_set_sphere( int s, float cx, float cy, float cz, float r )
{
	b3Sphere sphere = { v3( cx, cy, cz ), r };
	b3Shape_SetSphere( shapes[s], &sphere );
}

EXPORT void sf_destroy_shape( int s )
{
	if ( s <= 0 || b3Shape_IsValid( shapes[s] ) == false ) return;
	b3DestroyShape( shapes[s], true );
	freeShapes[freeShapeCount++] = s;
}

// Position, rotation (x y z w), velocity, angular velocity, awake → scratch[0..13].
EXPORT void sf_read( int h )
{
	b3BodyId id = bodies[h];
	b3Pos p = b3Body_GetPosition( id );
	b3Quat q = b3Body_GetRotation( id );
	b3Vec3 v = b3Body_GetLinearVelocity( id ), w = b3Body_GetAngularVelocity( id );
	float* o = scratch;
	o[0] = p.x; o[1] = p.y; o[2] = p.z;
	o[3] = q.v.x; o[4] = q.v.y; o[5] = q.v.z; o[6] = q.s;
	o[7] = v.x; o[8] = v.y; o[9] = v.z;
	o[10] = w.x; o[11] = w.y; o[12] = w.z;
	o[13] = b3Body_IsAwake( id ) ? 1.0f : 0.0f;
}

EXPORT void sf_set_transform( int h, float x, float y, float z, float qx, float qy, float qz, float qw )
{
	b3Body_SetTransform( bodies[h], v3( x, y, z ), b3NormalizeQuat( (b3Quat){ { qx, qy, qz }, qw } ) );
}

EXPORT void sf_set_velocity( int h, float vx, float vy, float vz, float wx, float wy, float wz )
{
	b3Body_SetLinearVelocity( bodies[h], v3( vx, vy, vz ) );
	b3Body_SetAngularVelocity( bodies[h], v3( wx, wy, wz ) );
}

EXPORT void sf_impulse( int h, float x, float y, float z ) { b3Body_ApplyLinearImpulseToCenter( bodies[h], v3( x, y, z ), true ); }
EXPORT void sf_force( int h, float x, float y, float z ) { b3Body_ApplyForceToCenter( bodies[h], v3( x, y, z ), true ); }
EXPORT float sf_mass( int h ) { return b3Body_GetMass( bodies[h] ); }

EXPORT void sf_enable( int h, int on )
{
	if ( on ) b3Body_Enable( bodies[h] );
	else b3Body_Disable( bodies[h] );
}

EXPORT void sf_explode( float x, float y, float z, float radius, float falloff, float impulsePerArea, unsigned mask )
{
	b3ExplosionDef def = b3DefaultExplosionDef();
	def.maskBits = mask;
	def.position = v3( x, y, z );
	def.radius = radius;
	def.falloff = falloff;
	def.impulsePerArea = impulsePerArea;
	b3World_Explode( world, &def );
}

// ---------- ground ----------
// The ground is one static body holding a triangle mesh per chunk, so a crater only rebuilds the chunks it touches.
static int groundBody;
static b3ShapeId chunkShape[MAX_CHUNKS];
static b3MeshData* chunkMesh[MAX_CHUNKS];

// (Re)build chunk i from vcount vertices (xyz floats) and tcount triangles (3 ints each, counter-clockwise seen
// from outside). Returns 1 on success.
EXPORT int sf_ground_chunk( int i, float* verts, int vcount, int* idx, int tcount, float friction, unsigned cat )
{
	if ( groundBody == 0 ) groundBody = sf_body( 0, 0, 0, 0, 0, 0, 0, 0 );
	b3MeshDef def = { 0 };
	def.vertices = (b3Vec3*)verts;
	def.indices = idx;
	def.vertexCount = vcount;
	def.triangleCount = tcount;
	def.useMedianSplit = true;
	def.identifyEdges = true;
	b3MeshData* mesh = b3CreateMesh( &def, NULL, 0 );
	if ( mesh == NULL ) return 0;
	if ( chunkMesh[i] != NULL && b3Shape_IsValid( chunkShape[i] ) )
	{
		b3Shape_SetMesh( chunkShape[i], mesh, b3Vec3_one );
	}
	else
	{
		b3ShapeDef sd = shapeDef( 0.0f, friction, 0.0f, 0.0f, cat, ~0u );
		chunkShape[i] = b3CreateMeshShape( bodies[groundBody], &sd, mesh, b3Vec3_one );
	}
	if ( chunkMesh[i] != NULL ) b3DestroyMesh( chunkMesh[i] );
	chunkMesh[i] = mesh;
	return 1;
}

EXPORT void sf_ground_clear( void )
{
	for ( int i = 0; i < MAX_CHUNKS; ++i )
	{
		if ( chunkMesh[i] == NULL ) continue;
		b3DestroyShape( chunkShape[i], false );
		b3DestroyMesh( chunkMesh[i] );
		chunkMesh[i] = NULL;
	}
}

// ---------- ray casts ----------
typedef struct RayContext
{
	b3BodyId ignore;
	b3ShapeId shape;
	b3Pos point;
	b3Vec3 normal;
	float fraction;
	int hit;
} RayContext;

static float rayCallback( b3ShapeId shapeId, b3Pos point, b3Vec3 normal, float fraction, uint64_t material, int tri, int child, void* context )
{
	(void)material; (void)tri; (void)child;
	RayContext* c = context;
	if ( B3_ID_EQUALS( b3Shape_GetBody( shapeId ), c->ignore ) || b3Shape_IsSensor( shapeId ) ) return -1.0f;
	c->shape = shapeId; c->point = point; c->normal = normal; c->fraction = fraction; c->hit = 1;
	return fraction;
}

static RayContext castRay( b3Pos origin, b3Vec3 translation, unsigned mask, b3BodyId ignore )
{
	RayContext c = { ignore, b3_nullShapeId, b3Pos_zero, b3Vec3_zero, 1.0f, 0 };
	b3QueryFilter filter = { ~0ull, mask, 0, "starfall" };
	b3World_CastRay( world, origin, translation, filter, rayCallback, &c );
	return c;
}

// Closest hit along a ray: returns the fraction, or -1; the point and normal go to scratch[0..5].
EXPORT float sf_ray( float x, float y, float z, float dx, float dy, float dz, unsigned mask, int ignore )
{
	RayContext c = castRay( v3( x, y, z ), v3( dx, dy, dz ), mask, ignore > 0 ? bodies[ignore] : b3_nullBodyId );
	if ( c.hit == 0 ) return -1.0f;
	scratch[0] = c.point.x; scratch[1] = c.point.y; scratch[2] = c.point.z;
	scratch[3] = c.normal.x; scratch[4] = c.normal.y; scratch[5] = c.normal.z;
	return c.fraction;
}

// ---------- the character mover ----------
static int moverBody, moverAnchor;
static b3JointId moverJoint, pogoJoint;
static b3BodyId pogoSurface;

// Make body h a mover: rotation-locked, with a mover joint to a fixed anchor. One mover at a time.
EXPORT void sf_mover_create( int h )
{
	moverBody = h;
	if ( moverAnchor == 0 ) moverAnchor = sf_body( 0, 0, 0, 0, 0, 0, 0, 0 );
	b3MoverJointDef def = b3DefaultMoverJointDef();
	def.base.bodyIdA = bodies[moverAnchor];
	def.base.bodyIdB = bodies[h];
	def.base.collideConnected = true;
	moverJoint = b3CreateMoverJoint( world, &def );
	pogoJoint = b3_nullJointId;
	pogoSurface = b3_nullBodyId;
}

// One update before the world steps. up is the unit vector away from the planet's center. The pogo ray reaches
// rayLength down from the body's center; with a hit, a spring holds the center restLength above the ground with
// at most tension (pulling down) and compression (pushing up) newtons. (vx, vy, vz) is the velocity the mover
// joint drives toward in the plane under up, with at most moveForce newtons.
// Hits on surfaces steeper than minUp (the cosine of their slope) don't count as ground.
// Returns 1 if the ray hit ground; the hit point, normal and fraction go to scratch[0..6], the pogo's length to [7].
EXPORT int sf_mover_update( float upx, float upy, float upz, float rayLength, float restLength, float hertz, float damping,
							float tension, float compression, float vx, float vy, float vz, float moveForce, float minUp,
							unsigned mask )
{
	b3BodyId id = bodies[moverBody];
	b3Vec3 up = v3( upx, upy, upz );
	b3Quat frame = quatFromUp( up );

	// The mover joint drives in the xz plane of frame B, so turn frame B to the local up.
	b3Joint_SetLocalFrameB( moverJoint, (b3Transform){ b3Vec3_zero, frame } );
	b3MoverJoint_SetLinearVelocity( moverJoint, v3( vx, vy, vz ) );
	b3MoverJoint_SetMaxVelocityForce( moverJoint, moveForce );
	b3Joint_WakeBodies( moverJoint );

	b3Pos origin = b3Body_GetPosition( id );
	RayContext c = castRay( origin, b3MulSV( -rayLength, up ), mask, id );
	if ( c.hit == 0 || b3Dot( c.normal, up ) < minUp )
	{
		if ( b3Joint_IsValid( pogoJoint ) ) b3DestroyJoint( pogoJoint, false );
		pogoJoint = b3_nullJointId;
		pogoSurface = b3_nullBodyId;
		return 0;
	}

	b3BodyId surface = b3Shape_GetBody( c.shape );
	b3Transform frameA = { b3Body_GetLocalPoint( surface, c.point ), b3Quat_identity };
	b3Transform frameB = { b3Vec3_zero, frame };
	if ( b3Joint_IsValid( pogoJoint ) == false || B3_ID_EQUALS( surface, pogoSurface ) == false )
	{
		float impulse = 0.0f, velocity = 0.0f;
		if ( b3Joint_IsValid( pogoJoint ) )
		{
			// warm start the new joint from the old one
			impulse = b3PogoJoint_GetImpulse( pogoJoint );
			velocity = b3PogoJoint_GetCurrentSpeed( pogoJoint );
			b3DestroyJoint( pogoJoint, false );
		}
		b3PogoJointDef def = b3DefaultPogoJointDef();
		def.base.bodyIdA = surface;
		def.base.bodyIdB = id;
		def.base.localFrameA = frameA;
		def.base.localFrameB = frameB;
		def.base.collideConnected = true;
		def.normal = c.normal;
		def.restLength = restLength;
		def.hertz = hertz;
		def.dampingRatio = damping;
		def.maxTensionForce = tension;
		def.maxCompressionForce = compression;
		def.impulse = impulse;
		def.velocity = velocity;
		pogoJoint = b3CreatePogoJoint( world, &def );
		pogoSurface = surface;
	}
	else
	{
		b3Joint_SetLocalFrameA( pogoJoint, frameA );
		b3Joint_SetLocalFrameB( pogoJoint, frameB );
		b3PogoJoint_SetNormal( pogoJoint, c.normal );
		b3PogoJoint_SetRestLength( pogoJoint, restLength );
		b3PogoJoint_SetSpringHertz( pogoJoint, hertz );
		b3PogoJoint_SetSpringDampingRatio( pogoJoint, damping );
		b3PogoJoint_SetMaxTensionForce( pogoJoint, tension );
		b3PogoJoint_SetMaxCompressionForce( pogoJoint, compression );
	}

	scratch[0] = c.point.x; scratch[1] = c.point.y; scratch[2] = c.point.z;
	scratch[3] = c.normal.x; scratch[4] = c.normal.y; scratch[5] = c.normal.z;
	scratch[6] = c.fraction;
	scratch[7] = c.fraction * rayLength;
	return 1;
}

// Seconds the last sf_step took, from Box3D's own profile (milliseconds).
EXPORT float sf_step_ms( void ) { return b3World_GetProfile( world ).step; }
