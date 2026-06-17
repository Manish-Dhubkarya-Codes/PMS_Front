import React from "react";
import { FaPlus } from "react-icons/fa";
import { IoMdCloseCircle } from "react-icons/io";
import QuillEditor from "../../Screens/TextEditor";
import {
  serverURL,
  postData,
} from "../../BackendConnections/FetchBackendServices";

interface SOWField {
  title: string;
  content: string;
}

interface SOWProps {
  showSOWModal: boolean;
  onClose: () => void;
  projectTitle: string;
  projectId: string; // Added projectId prop for file uploads
  sowFields: SOWField[];
  onSowFieldsChange: (fields: SOWField[]) => void;
  loading: boolean;
  onSubmit: () => void;
}

const SOW: React.FC<SOWProps> = (props) => {
  const handleCancel = () => {
    props.onClose();
  };

  const handleFieldChange = (index: number, key: keyof SOWField, value: string) => {
    const updatedFields = props.sowFields.map((field, i) =>
      i === index ? { ...field, [key]: value } : field
    );
    props.onSowFieldsChange(updatedFields);
  };

  const addField = () => {
    props.onSowFieldsChange([...props.sowFields, { title: '', content: '' }]);
  };

  const removeField = (index: number) => {
    if (props.sowFields.length > 1) {
      const updatedFields = props.sowFields.filter((_, i) => i !== index);
      props.onSowFieldsChange(updatedFields);
    }
  };

  const handleFileUpload = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("projectId", props.projectId);
    try {
      const response = await postData(
        `clientproject/upload_file`,
        formData
      );
      if (response.status) {
        return `${serverURL}${response.data.fileUrl}`;
      } else {
        throw new Error("Upload failed");
      }
    } catch (error) {
      console.error("File upload error:", error);
      throw error;
    }
  };

  if (!props.showSOWModal) return null;

  return (
    <div className="fixed inset-0 z-50 font-librefranklin flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-white/20 backdrop-blur-sm z-40" />

      <div className="relative z-50 w-full max-w-xl p-6 pt-10 pb-10 rounded-xl border border-white/50 bg-white backdrop-blur-3xl shadow-xl">
        <div className="flex justify-between items-center border-b border-gray-400 pb-3 mb-5">
          <div className="text-xl font-bold tracking-wide bg-gradient-to-r from-[#031746] to-[#0982fa] bg-clip-text text-transparent">
            Create SOW
          </div>
          <div
            onClick={handleCancel}
            className="text-gray-500 hover:scale-110 hover:text-[#fc134c] cursor-pointer"
          >
            <IoMdCloseCircle size={25} className="text-black hover:text-[#fc134c] cursor-pointer transition" />
          </div>
        </div>

        <div className="space-y-5 max-h-[60vh] thin-scroll overflow-y-auto text-gray-800 pr-2">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">
            {props.projectTitle}
          </h3>

          {props.sowFields.map((field, index) => (
            <div key={index} className="space-y-3 border border-gray-200 p-3 rounded-lg">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-gray-700">
                  Field {index + 1} Title*
                </label>
                {props.sowFields.length > 1 && (
                  <div
                    onClick={() => removeField(index)}
                    className="text-red-500 cursor-pointer hover:text-red-700 p-1 rounded-full hover:bg-red-100 transition"
                  >
                    <IoMdCloseCircle size={20} />
                  </div>
                )}
              </div>
              <div className="w-full p-[2px] rounded-[5px] bg-blue-300 focus-within:bg-gradient-to-r focus-within:from-[#DFFF00] focus-within:to-[#6495ED] transition">
                <input
                  type="text"
                  value={field.title}
                  onChange={(e) => handleFieldChange(index, 'title', e.target.value)}
                  placeholder={`Enter title for field ${index + 1}`}
                  className="w-full px-4 py-1.5 text-[14px] rounded-[4px] bg-white text-gray-800 placeholder-gray-400 focus:ring-0 outline-none transition"
                />
              </div>

              <label className="text-sm text-start font-semibold text-gray-700 block mb-1">
                Field {index + 1} Content*
              </label>
              <QuillEditor
                initialText={field.content}
                onChange={(html) => handleFieldChange(index, 'content', html)}
                placeholder={`Enter content for ${field.title || `field ${index + 1}`}`}
                onFileUpload={handleFileUpload}
              />
            </div>
          ))}

          <div className="flex justify-center">
            <div
              onClick={addField}
              className="flex cursor-pointer items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition text-sm font-medium"
            >
              <FaPlus size={16} />
              Add Field
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <div
              onClick={handleCancel}
              className="
  w-full cursor-pointer 
  hover:scale-80 
  duration-300 
  bg-red-300 
  rounded-lg  
  py-1.5 
  text-sm 
  font-semibold 
  transition-transform
"
            >
              Cancel
            </div>
            <div
              className="
  w-full cursor-pointer 
  hover:scale-80 
  duration-300 
  bg-green-300 
  rounded-lg  
  py-1.5 
  text-sm 
  font-semibold 
  transition-transform
"
              onClick={props.onSubmit}
            >
              {props.loading ? "Submitting..." : "Submit"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SOW;