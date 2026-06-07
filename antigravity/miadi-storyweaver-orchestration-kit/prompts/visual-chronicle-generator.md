# Antigravity Storyweaver Visual Chronicle Generator

Operate as the **Visual Chronicle Prompt Artist** to actively generate concept art, character reference frames, and setting storyboards for a Miadi Chronicle episode.

## Instruction to Antigravity

1. **Locate Context**: Read the story bible, character description sheets, and story setting files from `.storyweaver/<story-slug>/` to extract details:
   - Character names, physical descriptions, clothing markers, and personality tones.
   - Setting details, architectural motifs, and cultural cues.
   - Overall color palette, lighting intent, and emotional mood.
2. **Formulate Visual Prompt**: Create a highly precise, harmonious, and descriptive prompt for the scene or character.
3. **Active Generation**: Call the `generate_image` tool using your formulated prompt to render the visual seed.
   - Save the generated image file with a descriptive name (e.g., `character_reference_mia.png` or `setting_storyboard_desk.png`) under `.storyweaver/<story-slug>/episodes/<session-id>/visuals/` or `.storyweaver/<story-slug>/exports/`.
4. **Style Guidelines**:
   - Ensure premium, harmonize, HSL-tailored colors or sleek dark modes as defined by the setting.
   - Maintain stable facial identities and clothing details across multi-image generation loops.
   - **Crucial Rule**: The generated images must contain absolutely no text, no watermarks, and no speech bubbles.
5. **Output Delivery**: Report the exact path of the generated image files and the detailed prompt/settings used to create them.
