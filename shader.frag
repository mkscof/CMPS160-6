// this is the fragment shader: it is called for each fragment (i.e. a pixel)

#ifdef GL_ES
precision highp float;
precision highp int;
#endif

uniform vec3 u_LightColor;
uniform vec3 u_LightPosition;
uniform vec3 u_AmbientLight;
uniform vec3 u_SpecularLight;

varying vec4 v_Color;
varying vec3 v_Normal;
varying vec3 v_Position;

uniform float u_shine;
uniform int u_Picked;
uniform int u_shade_toggle;

void main() {
	vec3 normal = normalize(v_Normal);
	vec3 lightDirection = normalize(u_LightPosition - v_Position);
	
	float nDotL = max(dot(lightDirection, v_Normal), 0.0);

	vec3 viewDirection = vec3(0, 0, 1);
	vec3 reflectedVector = reflect(lightDirection, normal);

	float dotted = dot(reflectedVector, lightDirection);
	float rDotVp = max(pow(dotted, u_shine), 0.0);

	vec3 diffuse = u_LightColor * v_Color.rgb * nDotL;
 	vec3 ambient = u_AmbientLight * v_Color.rgb;
  	vec3 specular = u_SpecularLight * rDotVp;

  	vec3 final_color = diffuse + ambient + specular;

  	int highlight = 1;
	if(u_Picked == 0){
		highlight = 0;
	}
	else{
		highlight = 1;
	}

  	int shading_type = u_shade_toggle;
  	if(shading_type == 1){	//Phong
  		if(highlight == 0){
	      gl_FragColor = vec4(final_color, v_Color.a);
	    }
	    else{
	      gl_FragColor = vec4(final_color, v_Color.a - 0.1);
	    }
  	}
  	else{
  		gl_FragColor = v_Color;
  	}
}
