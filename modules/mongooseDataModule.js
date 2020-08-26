const passwordHash = require('password-hash')

const mongoose = require('mongoose')
const fs = require('fs')

const connectionString = 'mongodb+srv://project_drHouse:iq3B2TqA4lro2dGJ@cluster0.sagxs.mongodb.net/drHouse?retryWrites=true&w=majority'

const emailSender = require('./emailSender')

// get Schema object
const Schema = mongoose.Schema
// creat new users Schema
const usersSchema = new Schema({
    email: {
        type: String,
        unique: true,
        required: true
    },
    password: {
        type: String,
        required: true
    }
}) 

// creat Patient Schema
const patientSchema = new Schema({
    title: {
        type: String,
        required: true
    },
    description: {
        type: String
    },
    pdfUrl: {
        type: String,
        required: true
    },
    imgs: {
        type: [String],
        required: true,
        min: 1
    },
    userid: {
        type: String,
        required: true
    }
})

// create Users model
const Users = mongoose.model('users', usersSchema)
// create Patients model
const Patients = mongoose.model('patients', patientSchema)

function connect() {
    return new Promise ((resolve, reject) => {
        if (mongoose.connection.readyState === 1) {
            resolve()
        } else {
            mongoose.connect(connectionString, {
                useUnifiedTopology: true,
                useCreateIndex: true,
                useNewUrlParser: true
            }).then(() => {
                resolve()
            }).catch(error => {
                reject(error)
            })
        }
    })
}

function registerUser(email, password) {
    return new Promise((resolve, reject) => {
        connect().then(() => {
            // create new user
            const newUser = new Users({
                email: email,
                password: passwordHash.generate(password)
            })
            // save the newUser in the database
            newUser.save().then(result => {
                console.log(result)
                resolve()
            }).catch(error => {
                console.log(error.code)
                if (error.code === 11000) {
                    reject('exist')
                } else {
                    reject(error)
                }
            })
        }).catch(error => {
            reject(error)
        })
    })
}

function checkUser(email, password) {
    return new Promise((resolve, reject) => {
        connect().then(() => {
            Users.findOne({email: email}).then(user => {
                if (user) {
                    if (passwordHash.verify(password, user.password)) {
                        resolve(user)
                    } else {
                        reject(3)
                    }
                } else {
                    reject(3)
                }
            })
        }).catch(error => {
            reject(error)
        })
    })
}

function addPatient(patientTitle, patientDescription, patientPdf, patientImgs, userid) {
    return new Promise((resolve, reject) => {
        connect().then(() => {
            Patients.findOne({
                title: patientTitle,
                userid: userid
            }).then(findPatient => {
                if (findPatient) {
                    reject(3)
                } else {
                    const imgsArr = []
                    patientImgs.forEach((img, idx) => {
                        let ext = img.name.substr(img.name.lastIndexOf('.'))
                        let newName = patientTitle.trim().replace(/ /g, '_') + '_' + userid + '_' + idx + ext
                        img.mv('./public/uploadedfiles/' + newName)
                        imgsArr.push('/uploadedfiles/' + newName)
                    })
                    // set a new pdf file name
                    let pdfName = patientTitle.trim().replace(/ /g, '_') + '_' + userid + '.pdf'
                    patientPdf.mv('./public/uploadedfiles/' + pdfName)
                    let pdfNewUrl = '/uploadedfiles/' + pdfName
                    const newPatient = new Patients({
                        title: patientTitle,
                        description: patientDescription,
                        pdfUrl: pdfNewUrl,
                        imgs: imgsArr,
                        userid: userid
                    })
                    newPatient.save().then(() => {
                        resolve()
                    }).catch(error => {
                        reject(error)
                    })
                }
            }).catch(error => {
                reject(error)
            })
        }).catch(error => {
            reject(error)
        })
    })
}

function getAllPatients() {
    return new Promise((resolve, reject) => {
        connect().then(() => {
            Patients.find().then(patients => {
                patients.forEach(patient => {
                    patient['id'] = patient['_id']
                })
                resolve(patients)
            }).catch(error => {
                reject(error)
            })            
        }).catch(error => {
            reject(error)
        })
    })
}

function getPatient(id) {
    return new Promise((resolve, reject) => {
        connect().then(() => {
            Patients.findOne({_id: id}).then(patient => {
                if(patient) {
                    patient.id = patient._id
                    resolve(patient)
                } else {
                    reject(new Error('Can\'t find a patient with this id : ' + id))
                }
            }).catch(error => {
                reject(error)
            })
        }).catch(error => {
            reject(error)
        })
    })
}

function doctorPatients(userid) {
    return new Promise((resolve, reject) => {
        connect().then(() => {
            Patients.find({
                userid: userid
            }).then(patients => {
                patients.forEach(patient => {
                    patient['id'] = patient['_id']
                })
                resolve(patients)
            }).catch(error => {
                reject(error)
            })
        }).catch(error => {
            reject(error)
        })
    })
}

function updatePatient(patientid, newPatientTitle, oldImgsUrls, patientDescription, newPdfPatient, newImgs, userid) {

    return new Promise((resolve, reject) => {
        try {
            (async () => {
                let oldPatientData = await getPatient(patientid)
                const deletedImgs = []
                const keepImgs = []
                
                oldPatientData.imgs.forEach(img => {
                    if (oldImgsUrls.indexOf(img) >= 0 ) {
                        keepImgs.push(img)
                        } else {
                            deletedImgs.push(img)
                        }
                    })
                    const newImgsUrlsArr = []
                    newImgs.forEach((img, idx) => {
                        const imgExt = img.name.substr(img.name.lastIndexOf('.'))
                        const newImgName = newPatientTitle.trim().replace(/ /g, '_') + '_' + userid + '_' + idx + '_' + (oldPatientData.__v + 1) + imgExt
                        newImgsUrlsArr.push('/uploadedfiles/' + newImgName)
                        img.mv('./public/uploadedfiles/' + newImgName)
                    })
                    deletedImgs.forEach(file => {
                        if (fs.existsSync('./public' + file)) {
                            fs.unlinkSync('./public' + file)
                        }
                    })
                    if (newPdfPatient) {
                        newPdfPatient.mv('./public' + oldPatientData.pdfUrl)
                    }
                    
                    await Patients.updateOne({_id : patientid}, {
                        
                            title: newPatientTitle,
                            description: patientDescription,
                            imgs: [...keepImgs, ...newImgsUrlsArr],
                            $inc: {__v: 1}                        
                    })
                    resolve()                
            })()            
        } catch (error){
            reject(error)
        }
    })
}

function deletePatient(patientid, userid) {
    return new Promise((resolve, reject) => {
        getPatient(patientid).then(patient => {
            if (patient.userid === userid) {
                patient.imgs.forEach(img => {
                    if (fs.existsSync('./public' + img)) {
                        fs.unlinkSync('./public' + img)
                    }
                })
                if (fs.existsSync('./public' + patient.pdfUrl)) {
                    fs.unlinkSync('./public' + patient.pdfUrl)
                }
                    
                    Patients.deleteOne({_id: patientid}).then(() => {
                        resolve()
                    }).catch(error => {
                        reject(error)
                    })
                
            } else {
                reject(new Error('hacking try, not this time'))
            }
        }).catch(error => {
            reject(error)
        })
    })
}

module.exports = {
    registerUser,
    checkUser,
    addPatient,
    getAllPatients,
    getPatient,
    doctorPatients,
    updatePatient,
    deletePatient
}

