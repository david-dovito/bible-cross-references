/**
 * GLSL (WebGL2) for the arc diagram. Arc geometry is computed on the GPU from per-link
 * endpoints and view uniforms, so zooming and panning never re-upload link data.
 *
 * An arc from along-positions `a` to `b` is half an ellipse: its center is midway, its width is
 * `|b - a|`, and its height is half the width (a semicircle) up to `u_maxHeight`, so distant
 * links flatten instead of leaving the screen.
 */

const COMMON = /* glsl */ `
  precision highp float;

  uniform vec2 u_viewport;   // stage size, CSS px
  uniform vec2 u_view;       // visible window: start, end (verse units)
  uniform vec2 u_axis;       // along-axis pixel range of the window
  uniform float u_baseline;  // across-axis pixel coordinate of the axis
  uniform float u_maxHeight; // tallest arc, px
  uniform float u_vertical;  // 0: horizontal axis, arcs rise up; 1: vertical axis, arcs go right
  uniform float u_reveal;    // the intro's progress, 0 to 1
  uniform float u_total;     // verses on the axis, to place an arc's source along the intro
  uniform vec3 u_palette[10];

  const float PI = 3.14159265;

  float alongOf(float verse) {
    return u_axis.x + (verse - u_view.x) / (u_view.y - u_view.x) * (u_axis.y - u_axis.x);
  }

  // Arc point at angle theta (0 at a, PI at b) in local (along, height) coordinates.
  vec2 arcLocal(float a, float b, float theta) {
    float radius = 0.5 * (b - a);
    float height = min(abs(radius), u_maxHeight);
    return vec2(0.5 * (a + b) - radius * cos(theta), height * sin(theta));
  }

  vec2 arcTangent(float a, float b, float theta) {
    float radius = 0.5 * (b - a);
    float height = min(abs(radius), u_maxHeight);
    return vec2(radius * sin(theta), height * cos(theta));
  }

  vec2 toScreen(vec2 local) {
    return u_vertical < 0.5
      ? vec2(local.x, u_baseline - local.y)
      : vec2(u_baseline + local.y, local.x);
  }

  vec2 toScreenDirection(vec2 local) {
    return u_vertical < 0.5 ? vec2(local.x, -local.y) : vec2(local.y, local.x);
  }

  vec4 toClip(vec2 px) {
    return vec4(px.x / u_viewport.x * 2.0 - 1.0, 1.0 - px.y / u_viewport.y * 2.0, 0.0, 1.0);
  }

  uniform vec3 u_tint;        // one color for a whole layer (the word layer's brass)…
  uniform float u_tintAmount; // …in place of the genres' (1) or not at all (0)

  vec3 arcColor(vec2 genres, float t) {
    vec3 byGenre = mix(u_palette[int(genres.x + 0.5)], u_palette[int(genres.y + 0.5)], t);
    return mix(byGenre, u_tint, u_tintAmount);
  }

  // The intro sweeps the Bible from Genesis to Revelation: each arc starts growing when the sweep
  // reaches its source, and the later the source, the later it starts. STAGGER is how much of
  // the intro that sweep takes, against the time any one arc takes to grow.
  const float STAGGER = 1.6;

  // How much of this arc is drawn (0 to 1), from where its source is.
  float arcReveal(float source) {
    float at = clamp(source / max(u_total, 1.0), 0.0, 1.0);
    return clamp(u_reveal * (1.0 + STAGGER) - at * STAGGER, 0.0, 1.0);
  }

  // Past the revealed share, vertices collapse onto its end, so each arc grows from its source.
  float revealed(float t, float reveal) {
    return min(t, reveal);
  }

  // Each arc also fades in while it grows.
  float revealFade(float reveal) {
    return smoothstep(0.0, 0.4, reveal);
  }
`;

/** Hairline arcs (GL_LINES), drawn with additive blending so dense regions glow. */
export const LINE_VERTEX_SHADER = /* glsl */ `
  ${COMMON}
  uniform float u_alpha;

  in vec3 position;   // x: t in [0, 1] along the arc
  in vec2 a_ends;
  in vec2 a_genres;
  in float a_weight;

  out vec4 v_color;

  void main() {
    float reveal = arcReveal(a_ends.x);
    float t = revealed(position.x, reveal);
    vec2 local = arcLocal(alongOf(a_ends.x), alongOf(a_ends.y), PI * t);
    gl_Position = toClip(toScreen(local));
    v_color = vec4(arcColor(a_genres, t), u_alpha * a_weight * revealFade(reveal));
  }
`;

/** Anti-aliased ribbons of constant screen width, for focused and hovered links. */
export const RIBBON_VERTEX_SHADER = /* glsl */ `
  ${COMMON}
  uniform float u_alpha;
  uniform float u_width;

  in vec3 position;   // x: t in [0, 1] along the arc; y: side, -1 or 1
  in vec2 a_ends;
  in vec2 a_genres;
  in float a_weight;

  out vec4 v_color;
  out float v_side;

  void main() {
    float reveal = arcReveal(a_ends.x);
    float t = revealed(position.x, reveal);
    float a = alongOf(a_ends.x);
    float b = alongOf(a_ends.y);
    vec2 point = toScreen(arcLocal(a, b, PI * t));
    vec2 tangent = toScreenDirection(arcTangent(a, b, PI * t));
    vec2 normal = length(tangent) > 1e-4 ? normalize(vec2(-tangent.y, tangent.x)) : vec2(0.0, 1.0);
    gl_Position = toClip(point + normal * position.y * u_width * 0.5);
    v_color = vec4(arcColor(a_genres, t), u_alpha * mix(0.55, 1.0, a_weight) * revealFade(reveal));
    v_side = position.y;
  }
`;

export const LINE_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;
  in vec4 v_color;
  out vec4 fragColor;
  void main() {
    fragColor = v_color;
  }
`;

export const RIBBON_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;
  in vec4 v_color;
  in float v_side;
  out vec4 fragColor;
  void main() {
    float edge = 1.0 - smoothstep(0.5, 1.0, abs(v_side));
    fragColor = vec4(v_color.rgb, v_color.a * edge);
  }
`;
